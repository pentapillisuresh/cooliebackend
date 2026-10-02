const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Worker, Booking, Job } = require('./models');
const { JOB_STATUS, BOOKING_STATUS } = require('./utils/constants');

// ─── In-memory stores ──────────────────────────────────────────
const activeUsers = new Map();       // socket.id -> userId
const userSockets = new Map();       // userId -> Set of socket ids
const bookingRooms = new Map();      // bookingId -> Set of userIds  ✅ declared

/**
 * Initialize Socket.io
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

  // ─── Helper: check booking access ───────────────────────────
  const getBookingAccess = async (socket, bookingId) => {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Job }],
    });

    if (!booking) return { allowed: false, booking: null };
    if (socket.userRole === 'admin') return { allowed: true, booking };
    if (booking.userId === socket.userId) return { allowed: true, booking };

    const worker = await Worker.findOne({ where: { userId: socket.userId } });
    if (worker && booking.Job?.workerId === worker.id) {
      return { allowed: true, booking, worker };
    }

    return { allowed: false, booking };
  };

  // ─── Auth middleware ────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user-${userId}`);
    console.log(`🟢 User ${userId} connected (${socket.id})`);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    activeUsers.set(socket.id, userId);

    // ─── Join booking room ─────────────────────────────────
    socket.on('join-booking', async (data) => {
      const { bookingId } = data || {};
      if (!bookingId) return;

      try {
        const { allowed, booking } = await getBookingAccess(socket, bookingId);

        if (!allowed) {
          return socket.emit('join-error', {
            bookingId,
            error: 'Access denied',
          });
        }

        socket.join(`booking-${bookingId}`);

        if (!bookingRooms.has(bookingId)) {
          bookingRooms.set(bookingId, new Set());
        }
        bookingRooms.get(bookingId).add(userId);

        socket.emit('joined-booking', { bookingId, success: true });
        console.log(`✅ User ${userId} joined booking-${bookingId}`);
      } catch (error) {
        console.error('❌ Join booking error:', error);
        socket.emit('join-error', {
          bookingId,
          error: 'Server error',
          message: error.message,
        });
      }
    });

    // ─── Leave booking room ────────────────────────────────
    socket.on('leave-booking', ({ bookingId } = {}) => {
      if (!bookingId) return;
      socket.leave(`booking-${bookingId}`);

      const users = bookingRooms.get(bookingId); // ✅ fixed
      if (users) {
        users.delete(userId);
        if (users.size === 0) bookingRooms.delete(bookingId);
      }
      console.log(`User ${userId} left booking-${bookingId}`);
    });

    // ─── Worker location update ────────────────────────────
    socket.on('update-worker-location', async (data) => {
      const { bookingId, latitude, longitude } = data || {};
      try {
        if (
          !bookingId ||
          typeof latitude !== 'number' ||
          typeof longitude !== 'number' ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180
        ) {
          return;
        }

        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        if (!worker) return;

        const job = await Job.findOne({ where: { bookingId, workerId: worker.id } });
        if (!job) return;

        await job.update({
          workerLatitude: latitude,
          workerLongitude: longitude,
        });

        io.to(`booking-${bookingId}`).emit('worker-location', {
          bookingId,
          workerId: worker.id,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Worker location update error:', error);
      }
    });

    // ─── User location update ──────────────────────────────
    socket.on('update-user-location', async (data) => {
      const { bookingId, latitude, longitude } = data || {};
      try {
        if (
          !bookingId ||
          typeof latitude !== 'number' ||
          typeof longitude !== 'number' ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180
        ) {
          return;
        }

        const job = await Job.findOne({ where: { bookingId } });
        if (!job) return;

        await job.update({
          userLatitude: latitude,
          userLongitude: longitude,
        });

        io.to(`booking-${bookingId}`).emit('user-location', {
          bookingId,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('User location update error:', error);
      }
    });

    // ─── Train tracking ────────────────────────────────────
    socket.on('update-train', async (data) => {
      try {
        const { bookingId, trainStatus, coachNumber, estimatedArrival } = data || {};
        if (!bookingId) return;

        const booking = await Booking.findByPk(bookingId, {
          include: [{ model: Job }],
        });
        if (!booking) return;

        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        const isWorker = worker && booking.Job?.workerId === worker.id;
        if (!isWorker && socket.userRole !== 'admin') return;

        const details = booking.details || {};
        details.trainStatus = trainStatus;
        details.coachNumber = coachNumber;
        details.estimatedArrival = estimatedArrival;
        await booking.update({ details });

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

    // ─── Job status change ─────────────────────────────────
    socket.on('job-status-change', async (data) => {
      try {
        const { bookingId, status, otp } = data || {};
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

        if (status === 'accepted') {
          await job.update({ status: JOB_STATUS.ARRIVED, startedAt: new Date() });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'accepted',
            message: 'Worker has accepted the job.',
          });
        } else if (status === 'rejected') {
          await job.update({ status: JOB_STATUS.CANCELLED });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'cancelled',
            message: 'Worker cancelled the job.',
          });
        } else if (status === 'started') {
          if (!otp) {
            return socket.emit('error', { message: 'OTP required' });
          }
          if (job.confirmationOtp !== otp) {
            return socket.emit('error', { message: 'Invalid OTP' });
          }
          await job.update({
            status: JOB_STATUS.IN_PROGRESS,
            confirmationOtp: null,
          });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'in-progress',
            message: 'Work has started.',
          });
        } else if (status === 'completed') {
          if (!otp) {
            return socket.emit('error', { message: 'Completion OTP required' });
          }
          if (job.completionOtp !== otp) {
            return socket.emit('error', { message: 'Invalid completion OTP' });
          }
          await job.update({
            status: JOB_STATUS.COMPLETED,
            completedAt: new Date(),
          });
          await booking.update({ status: BOOKING_STATUS.PAYMENT_PENDING });
          io.to(`booking-${bookingId}`).emit('job-status-update', {
            bookingId,
            status: 'completed',
            message: 'Job completed. Payment pending.',
          });
        } else {
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

    // ─── Chat message ──────────────────────────────────────
    socket.on('chat-message', (data) => {
      const { bookingId, message, senderId, senderType } = data || {};
      if (!bookingId || !message) return;

      io.to(`booking-${bookingId}`).emit('chat-message', {
        bookingId,
        message,
        senderId,
        senderType,
        timestamp: new Date(),
      });
    });

    // ─── Worker on-the-way location ────────────────────────
    socket.on('worker-location-update', async (data) => {
      const { bookingId, latitude, longitude, speed, heading } = data || {};
      if (!bookingId) return;

      try {
        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        if (!worker) return;

        const job = await Job.findOne({ where: { bookingId, workerId: worker.id } });
        if (!job) return;

        await job.update({
          workerLatitude: latitude,
          workerLongitude: longitude,
        });

        io.to(`booking-${bookingId}`).emit('worker-location', {
          bookingId,
          workerId: worker.id,
          latitude,
          longitude,
          speed,
          heading,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('worker-location-update error:', error);
      }
    });

    // ─── Disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔴 User ${userId} disconnected (${socket.id})`);
      activeUsers.delete(socket.id);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }

      bookingRooms.forEach((users, bookingId) => {
        if (users.has(userId)) {
          users.delete(userId);
          if (users.size === 0) bookingRooms.delete(bookingId);
        }
      });
    });
  });

  // ─── External helpers ──────────────────────────────────────
  const emitToUser = (userId, event, data) => {
    const sockets = userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      for (const socketId of sockets) {
        io.to(socketId).emit(event, data);
      }
    }
  };

  const emitToBooking = (bookingId, event, data) => {
    io.to(`booking-${bookingId}`).emit(event, data);
  };

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

  const notifyUserOfJobUpdate = (userId, bookingId, status) => {
    emitToUser(userId, 'job-status-updated', {
      bookingId,
      status,
      message: `Your booking #${bookingId} status changed to ${status}`,
    });
  };

  const sendTrainUpdate = (bookingId, update) => {
    emitToBooking(bookingId, 'train-update', update);
  };

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