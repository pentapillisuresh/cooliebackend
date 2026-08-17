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
    console.log(`🟢 User ${userId} connected (${socket.id})`);

    // Store socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // ─── Join booking room ────────────────────────────────────────────
    socket.on('join-booking', async (data) => {
      const { bookingId } = data;
      if (!bookingId) return;
      try {
        const booking = await Booking.findByPk(bookingId);
        if (!booking) return;
        // Only allow if user is booking owner or assigned worker
        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        const isOwner = booking.userId === socket.userId;
        const isWorker = worker && booking.Job?.workerId === worker.id;
        if (isOwner || isWorker || socket.userRole === 'admin') {
          socket.join(`booking-${bookingId}`);
          console.log(`User ${userId} joined booking-${bookingId}`);
          socket.emit('joined-booking', { bookingId, success: true });
        } else {
          socket.emit('join-error', { bookingId, error: 'Access denied' });
        }
      } catch (error) {
        console.error('Join booking error:', error);
        socket.emit('join-error', { bookingId, error: 'Server error' });
      }
    });

    // ─── Leave booking room ───────────────────────────────────────────
    socket.on('leave-booking', (data) => {
      const { bookingId } = data;
      if (bookingId) {
        socket.leave(`booking-${bookingId}`);
        console.log(`User ${userId} left booking-${bookingId}`);
      }
    });

    // ─── Location update (worker) ──────────────────────────────────────
    socket.on('update-location', async (data) => {
      try {
        const { bookingId, latitude, longitude } = data;
        if (!bookingId || !latitude || !longitude) return;
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
        const { bookingId, status } = data;
        if (!bookingId || !status) return;
        const booking = await Booking.findByPk(bookingId, {
          include: [{ model: Job }],
        });
        if (!booking) return;
        const worker = await Worker.findOne({ where: { userId: socket.userId } });
        const isWorker = worker && booking.Job?.workerId === worker.id;
        if (!isWorker && socket.userRole !== 'admin') return;
        // Update job status
        if (booking.Job) {
          await booking.Job.update({ status });
        }
        // Broadcast
        io.to(`booking-${bookingId}`).emit('job-status', {
          bookingId,
          status,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error('Job status change error:', error);
      }
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
    });
  });

  // ─── Helper functions to emit events from outside ───────────────────

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
    emitToUser(userId, 'job-status-update', {
      bookingId,
      status,
      message: `Your booking #${bookingId} status changed to ${status}`,
    });
  };

  /**
   * Send real-time train tracking update
   */
  const sendTrainUpdate = (bookingId, update) => {
    emitToBooking(bookingId, 'train-tracking', update);
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