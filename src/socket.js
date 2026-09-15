const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Worker, Booking, Job } = require('./models');
const { JOB_STATUS, BOOKING_STATUS } = require('./utils/constants');

// Store active connections (socket.id -> userId)
const activeUsers = new Map();
// Store user's socket IDs (userId -> set of socket ids)
const userSockets = new Map();

/**
 * Initialize Socket.io with the HTTP server
 */
const initSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── Authentication middleware ──────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user-${userId}`);
    console.log(`🟢 User ${userId} connected (${socket.id})`);

    // Store socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // ─── Join booking room ────────────────────────────────────────────
    socket.on('join-booking', async (data) => {
      console.log('🔥 join-booking RECEIVED');
      console.log('📦 Data:', data);
      console.log('👤 User:', socket.userId);
      console.log('🎭 Role:', socket.userRole);

      const { bookingId } = data || {};

      if (!bookingId) {
        console.log('❌ No bookingId');
        return;
      }

      try {
        console.log(`🔍 Checking booking ${bookingId}`);

        const result = await getBookingAccess(socket, bookingId);

        const { allowed, booking } = result;

        if (!allowed) {
          console.log('❌ ACCESS DENIED');

          return socket.emit('join-error', {
            bookingId,
            error: 'Access denied',
          });
        }

        console.log('✅ ACCESS GRANTED');

        socket.join(`booking-${bookingId}`);

        console.log(`✅ User ${socket.userId} joined booking-${bookingId}`);

        socket.emit('joined-booking', {
          bookingId,
          success: true,
        });

        console.log('📤 joined-booking SENT');

      } catch (error) {
        console.error('❌ Join booking error:', error);

        socket.emit('join-error', {
          bookingId,
          error: 'Server error',
          message: error.message,
        });
      }
    });

    // ─── Leave booking room ───────────────────────────────────────────
    socket.on('leave-booking', (data) => {
      const { bookingId } = data;
      if (bookingId) {
        socket.leave(`booking-${bookingId}`);
        const users = bookingRooms.get(bookingId);
        if (users) {
          users.delete(userId);
          if (users.size === 0) bookingRooms.delete(bookingId);
        }
        console.log(`User ${userId} left booking-${bookingId}`);
      }
    });

    // ─── Location update (worker) ──────────────────────────────────────
    socket.on('update-worker-location', async (data) => {
      const { bookingId, latitude, longitude } = data;
      try {
        if (
          !bookingId ||
          typeof latitude !== 'number' ||
          typeof longitude !== 'number'
        ) {
          return;
        }

        if (latitude < -90 || latitude > 90) return;
        if (longitude < -180 || longitude > 180) return;

        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        if (!worker) return;
        const job = await Job.findOne({ where: { bookingId, workerId: worker.id } });
        if (!job) return;
        // Update job location
        await job.update({ workerLatitude: latitude, workerLongitude: longitude });
        // Broadcast to users in the booking room
        io.to(`booking-${bookingId}`).emit('worker-location', {
          bookingId,
          workerId: worker.id,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('join-error', {
          bookingId,
          error: 'Server error',
          message: error.message,
        });

      }
    });

    socket.on('update-user-location', async (data) => {
      const { bookingId, latitude, longitude } = data;
      try {
        if (
          !bookingId ||
          typeof latitude !== 'number' ||
          typeof longitude !== 'number'
        ) {
          return;
        }

        if (latitude < -90 || latitude > 90) return;
        if (longitude < -180 || longitude > 180) return;

        const user = await User.findOne({ where: { userId: socket.userId } });
        if (!user) return;
        const job = await Job.findOne({ where: { bookingId } });
        if (!job) return;
        // Update job location
        await job.update({ userLatitude: latitude, userLongitude: longitude });
        // Broadcast to users in the booking room
        io.to(`booking-${bookingId}`).emit('user-location', {
          bookingId,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('join-error', {
          bookingId,
          error: 'Server error',
          message: error.message,
        });

      }
    });

    // ─── Train tracking (for railway jobs) ─────────────────────────────
    socket.on('update-train', async (data) => {
      try {
        const { bookingId, trainStatus, coachNumber, estimatedArrival } = data;
        if (!bookingId) return;
        const booking = await Booking.findByPk(bookingId, {
          include: [{ model: Job }],
        });
        if (!booking) return;
        // Authorization: only assigned worker or admin
        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        const isWorker = worker && booking.Job?.workerId === worker.id;
        if (!isWorker && socket.userRole !== 'admin') return;
        // Update booking details (store in details JSON)
        const details = booking.details || {};
        details.trainStatus = trainStatus;
        details.coachNumber = coachNumber;
        details.estimatedArrival = estimatedArrival;
        await booking.update({ details });
        // Broadcast to all in room
        io.to(`booking-${bookingId}`).emit('train-update', {
          bookingId,
          trainStatus,
          coachNumber,
          estimatedArrival,
        });
      } catch (error) {
        console.error('Train update error:', error);
      }
    });

    // ─── Job status change ─────────────────────────────────────────────
    // (Used by worker/admin to notify user)
    socket.on('job-status-change', async (data) => {
      try {
        const { bookingId, status, otp } = data;
        if (!bookingId || !status) return;

        const booking = await Booking.findByPk(bookingId, {
          include: [{ model: Job }],
        });
        if (!booking) return;

        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        const isWorker = worker && booking.Job?.workerId === worker.id;
        if (!isWorker && socket.userRole !== 'admin') return;

        const job = booking.Job;
        if (!job) return;

        // ─── Handle specific status transitions ─────────────────────
        if (status === 'accepted') {
          // Worker accepts the job
          await job.update({ status: JOB_STATUS.ARRIVED, startedAt: new Date() });
          // Notify user
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'accepted',
            message: 'Worker has accepted the job.',
          });
        } else if (status === 'rejected') {
          // Worker rejects the job (cancel)
          await job.update({ status: JOB_STATUS.CANCELLED });
          // Notify user
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'cancelled',
            message: 'Worker cancelled the job.',
          });
        } else if (status === 'started') {
          // Worker started work after verifying OTP
          if (!otp) {
            socket.emit('error', { message: 'OTP required to start work' });
            return;
          }
          // Verify the work OTP (stored in job or booking)
          if (job.confirmationOtp !== otp) {
            socket.emit('error', { message: 'Invalid OTP' });
            return;
          }
          // OTP correct -> start work
          await job.update({ status: JOB_STATUS.IN_PROGRESS, confirmationOtp: null });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'in-progress',
            message: 'Work has started.',
          });
        } else if (status === 'completed') {
          // Worker completed work after completion OTP
          if (!otp) {
            socket.emit('error', { message: 'Completion OTP required' });
            return;
          }
          // Verify completion OTP (could be a separate field)
          if (job.completionOtp !== otp) {
            socket.emit('error', { message: 'Invalid completion OTP' });
            return;
          }
          await job.update({ status: JOB_STATUS.COMPLETED, completedAt: new Date() });
          await booking.update({ status: BOOKING_STATUS.PAYMENT_PENDING });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'completed',
            message: 'Job completed. Payment pending.',
          });
        } else {
          // Generic status update
          await job.update({ status });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status,
            message: `Job status updated to ${status}`,
          });
        }
      } catch (error) {
        console.error('Job status change error:', error);
        socket.emit('error', { message: 'Failed to update job status' });
      }
    });

    // ─── Chat message ─────────────────────────────────────────────
    socket.on('chat-message', async (data) => {
      try {
        const { bookingId, message, senderId, senderType } = data;
        if (!bookingId || !message) return;

        // Broadcast to everyone in the booking room
        io.to(`booking-${bookingId}`).emit('chat-message', {
          bookingId,
          message,
          senderId,
          senderType,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    // Worker sends location while on the way
    socket.on('worker-location-update', async (data) => {
      const { bookingId, latitude, longitude, speed, heading } = data;
      if (!bookingId) return;

      const worker = await Worker.findOne({ where: { userId: socket.userId } });
      if (!worker) return;

      const job = await Job.findOne({ where: { bookingId, workerId: worker.id } });
      if (!job) return;

      await job.update({
        workerLatitude: latitude,
        workerLongitude: longitude,
      });

      // Broadcast to the customer in the booking room
      io.to(`booking-${bookingId}`).emit('worker-location', {
        bookingId,
        workerId: worker.id,
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date(),
      });
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔴 User ${userId} disconnected (${socket.id})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      // Remove from booking rooms
      bookingRooms.forEach((users, bookingId) => {
        if (users.has(userId)) {
          users.delete(userId);
          if (users.size === 0) bookingRooms.delete(bookingId);
        }
      });
    });
  });

  // ─── Helper functions to emit events from outside ───────────────────
  const getBookingAccess = async (socket, bookingId) => {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Job }],
    });

    if (!booking) {
      return { allowed: false, booking: null };
    }

    if (socket.userRole === 'admin') {
      return { allowed: true, booking };
    }

    if (booking.userId === socket.userId) {
      return { allowed: true, booking };
    }

    const worker = await Worker.findOne({
      where: { userId: socket.userId },
    });

    if (worker && booking.Job?.workerId === worker.id) {
      return { allowed: true, booking, worker };
    }

    return { allowed: false, booking };
  };

  /**
   * Emit event to a specific user (by userId)
   */
  const emitToUser = (userId, event, data) => {
    const sockets = userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      for (const socketId of sockets) {
        io.to(socketId).emit(event, data);
      }
    }
  };

  /**
   * Emit event to a booking room
   */
  const emitToBooking = (bookingId, event, data) => {
    io.to(`booking-${bookingId}`).emit(event, data);
  };

  /**
   * Broadcast job assignment notification to a worker
   */
  const notifyWorkerOfJob = async (workerId, bookingId, jobData) => {
    const worker = await Worker.findByPk(workerId, {
      include: [{ model: User }],
    });
    if (worker && worker.User) {
      emitToUser(worker.User.id, 'new-job-assigned', {
        bookingId,
        jobData,
        message: 'You have a new job assignment',
      });
    }
  };

  /**
   * Notify user when job status changes
   */
  const notifyUserOfJobUpdate = (userId, bookingId, status) => {
    emitToUser(userId, 'job-status-updated', {
      bookingId,
      status,
      message: `Your booking #${bookingId} status changed to ${status}`,
    });
  };

  /**
   * Send real-time train tracking update
   */
  const sendTrainUpdate = (bookingId, update) => {
    emitToBooking(bookingId, 'train-update', update);
  };

  // Attach helpers to io instance for external use
  io.helpers = {
    emitToUser,
    emitToBooking,
    notifyWorkerOfJob,
    notifyUserOfJobUpdate,
    sendTrainUpdate,
  };

  return io;
};

module.exports = initSocket;