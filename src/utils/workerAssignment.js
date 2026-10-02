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
const findAvailableWorker = async (
  serviceId,
  scheduledDate,
  scheduledTime,
  location = null
) => {
  console.log("findAvailableWorker::", serviceId);

  // 1. Get service
  const service = await Service.findByPk(serviceId, {
    include: [{ model: Category }],
  });

  if (!service) return null;

  const serviceName = service.name.trim();
  const duration = service.duration || 0;

  // 2. Get active + verified workers
  const workers = await Worker.findAll({
    where: {
      status: "active",
      isVerified: true,
    },
  });

  if (!workers || workers.length === 0) {
    return null;
  }

  // 3. Filter workers who provide this service
  const matchingWorkers = workers.filter((worker) => {
    if (!worker.profession) return false;

    const professions = worker.profession
      .split(",")
      .map((item) => item.trim().toLowerCase());

    return professions.includes(serviceName.toLowerCase());
  });

  if (matchingWorkers.length === 0) {
    return null;
  }

  // 4. Filter by availability
  const availableWorkers = matchingWorkers.filter((worker) =>
    isWorkerAvailable(
      worker,
      scheduledDate,
      scheduledTime,
      duration
    )
  );

  if (availableWorkers.length === 0) {
    return null;
  }

  // 5. Calculate distance
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (
      lat1 == null ||
      lon1 == null ||
      lat2 == null ||
      lon2 == null
    ) {
      return Infinity;
    }

    const R = 6371;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // 6. Sort by nearest worker
  if (
    location?.latitude != null &&
    location?.longitude != null
  ) {
    availableWorkers.sort((a, b) => {
      const distanceA = getDistance(
        location.latitude,
        location.longitude,
        a.latitude,
        a.longitude
      );

      const distanceB = getDistance(
        location.latitude,
        location.longitude,
        b.latitude,
        b.longitude
      );

      return distanceA - distanceB;
    });
  }

  // 7. Return closest available worker
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
    userLatitude:booking.latitude,
    userLongitude:booking.longitude,
    assignedAt: new Date(),
  });
  await booking.update({ status: job.status });

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