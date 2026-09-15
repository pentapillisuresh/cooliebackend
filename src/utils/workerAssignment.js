const { Worker, Job, Booking, Service, Category,User } = require('../models');
const { Op } = require('sequelize');
const { JOB_STATUS, BOOKING_STATUS } = require('../utils/constants');
const { createNotification } = require('../controllers/notificationController');

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Check if two time windows overlap
 */
const windowsOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

/**
 * Check if a worker is available on a given date and time window
 * @param {object} worker - Worker instance
 * @param {string} scheduledDate - YYYY-MM-DD
 * @param {string} scheduledTime - HH:MM (or HH:MM:SS)
 * @param {number} durationMinutes - Service duration in minutes
 * @returns {boolean} - true if available
 */
const isWorkerAvailable = (worker, scheduledDate, scheduledTime, durationMinutes) => {
  // No schedule → always available
  if (!Array.isArray(worker.schedule) || worker.schedule.length === 0) {
    return true;
  }

  const startTime = scheduledTime.slice(0, 5); // HH:MM
  const totalBuffer = durationMinutes + 20; // service duration + 20 min buffer
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + totalBuffer;

  // Check if any schedule entry overlaps with the booking window
  const hasConflict = worker.schedule.some(entry => {
    // Skip if no date or date doesn't match
    if (!entry?.date || entry.date !== scheduledDate) {
      return false;
    }

    const entryStart = timeToMinutes((entry.startTime || '00:00').slice(0, 5));
    const entryEnd = timeToMinutes((entry.endTime || '23:59').slice(0, 5));

    // Overlap if booking window and schedule entry intersect
    return windowsOverlap(startMinutes, endMinutes, entryStart, entryEnd);
  });

  return !hasConflict;
};

/**
 * Find an available worker for a booking
 * @param {number} serviceId - Service ID
 * @param {string} scheduledDate - YYYY-MM-DD
 * @param {string} scheduledTime - HH:MM:SS
 * @param {object} location - { latitude, longitude } (optional)
 * @returns {Promise<Worker|null>}
 */
const findAvailableWorker = async (serviceId, scheduledDate, scheduledTime, location = null) => {
  console.log("findAvailableWorker::",serviceId)
  // 1. Get service with category and duration
  const service = await Service.findByPk(serviceId, {
    include: [{ model: Category }],
  });
  if (!service) return null;

  const profession = service.Category?.name;
  const duration = service.duration || 0; // in minutes

  // 2. Find active, verified workers with matching profession
  const workers = await Worker.findAll({
    where: {
      profession: profession,
      status: 'active',
      isVerified: true,
    },
  });

  if (!workers || workers.length === 0) return null;

  // 3. Filter by schedule availability
  const availableWorkers = workers.filter(worker =>
    isWorkerAvailable(worker, scheduledDate, scheduledTime, duration)
  );

  if (availableWorkers.length === 0) return null;

  // 4. Sort by location proximity (if lat/lng available)
  if (location?.latitude && location?.longitude) {
    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    availableWorkers.sort((a, b) => {
      const distA = getDistance(location.latitude, location.longitude, a.latitude, a.longitude);
      const distB = getDistance(location.latitude, location.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  // Return the closest/available worker
  return availableWorkers[0];
};

/**
 * Assign a worker to a booking
 * @param {object} booking - Booking instance
 * @param {object} service - Service instance (with Category)
 * @param {object} location - { latitude, longitude } (optional)
 * @returns {Promise<Job|null>}
 */
// At the top of the file, get the global io instance

// (Assuming io is stored globally in server.js: global.io = io)

const assignWorkerToBooking = async (booking, service, location = null) => {
  console.log("assignWorkerToBooking::",booking.serviceId)
  const worker = await findAvailableWorker(
    booking.serviceId,
    booking.scheduledDate,
    booking.scheduledTime,
    location || { latitude: booking.latitude, longitude: booking.longitude }
  );
  console.log("worker::",worker)
  if (!worker) return null;

  // Create job
  const job = await Job.create({
    bookingId: booking.id,
    workerId: worker.id,
    status: JOB_STATUS.ASSIGNED,
    assignedAt: new Date(),
  });

  // Update booking status
  await booking.update({ status: BOOKING_STATUS.ACCEPTED });

  // ─── Emit socket events ────────────────────────────────────────
  const io = global.io; // from server.js
  if (io) {
  // Notify worker
  await io.helpers.notifyWorkerOfJob(worker.id, booking.id, job);
  // Notify user
  io.helpers.notifyUserOfJobUpdate(
    booking.userId,
    booking.id,
    'accepted',
  );
  }


  // ─── Also create in‑app notification ─────────────────────────
  await createNotification(
    worker.userId,
    'New Job Assigned',
    `You have been assigned to booking #${booking.id}`,
    { bookingId: booking.id, jobId: job.id },
    'job'
  );

  return job;
};
module.exports = {
  findAvailableWorker,
  assignWorkerToBooking,
  isWorkerAvailable,
};