const { Training, TrainingVideo, Quiz, QuizQuestion, QuizAttempt, Certificate, Worker } = require('../models');
const { getPagination, getPagingData, generateOTP } = require('../utils/helpers');
const { Op } = require('sequelize');
const { USER_ROLES } = require('../utils/constants');

/**
 * Get all trainings (admin) or those applicable to the worker (worker)
 * Supports filtering by isActive, profession (admin), pagination
 */
exports.getTrainings = async (req, res, next) => {
  try {
    const { page, limit, isActive, profession } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // If worker is logged in, filter by their profession
    if (req.user.role === USER_ROLES.WORKER) {
      const worker = await Worker.findOne({ where: { userId: req.user.id } });
      if (worker && worker.profession) {
        where.applicableProfessions = {
          [Op.contains]: [worker.profession],
        };
      }
    } else if (req.user.role === USER_ROLES.ADMIN && profession) {
      where.applicableProfessions = {
        [Op.contains]: [profession],
      };
    }

    const data = await Training.findAndCountAll({
      where,
      include: [
        { model: TrainingVideo, order: [['sortOrder', 'ASC']] },
        { model: Quiz, include: [{ model: QuizQuestion }] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single training by ID with videos and quiz questions
 * Access: worker (if applicable) or admin
 */
exports.getTrainingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const training = await Training.findByPk(id, {
      include: [
        { model: TrainingVideo, order: [['sortOrder', 'ASC']] },
        {
          model: Quiz,
          include: [
            { model: QuizQuestion, order: [['sortOrder', 'ASC']] },
          ],
        },
      ],
    });

    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    // If worker, check if training applies to their profession
    if (req.user.role === USER_ROLES.WORKER) {
      const worker = await Worker.findOne({ where: { userId: req.user.id } });
      if (worker && training.applicableProfessions && !training.applicableProfessions.includes(worker.profession)) {
        return res.status(403).json({ error: 'Training not applicable to your profession' });
      }
    }

    // Optionally, get the worker's progress for this training (quiz attempts)
    let progress = null;
    if (req.user.role === USER_ROLES.WORKER) {
      const worker = await Worker.findOne({ where: { userId: req.user.id } });
      if (worker && training.Quiz) {
        const attempts = await QuizAttempt.findAll({
          where: { workerId: worker.id, quizId: training.Quiz.id },
        });
        progress = {
          attempts,
          passed: attempts.some(a => a.passed),
          bestScore: attempts.length ? Math.max(...attempts.map(a => a.score)) : 0,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: { ...training.toJSON(), progress },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Admin only ─────────────────────────────────────────────────────

/**
 * Create a new training (admin)
 */
exports.createTraining = async (req, res, next) => {
  try {
    const { title, slug, description, thumbnail, applicableProfessions, level, duration, isRequired, scheduledDate, meetingLink } = req.body;

    const training = await Training.create({
      title,
      slug,
      description,
      thumbnail,
      applicableProfessions: applicableProfessions || [],
      level: level || 'beginner',
      duration,
      isRequired: isRequired !== undefined ? isRequired : true,
      isActive: true,
      scheduledDate,
      meetingLink,
    });

    res.status(201).json({ success: true, data: training });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a training (admin)
 */
exports.updateTraining = async (req, res, next) => {
  try {
    const { id } = req.params;
    const training = await Training.findByPk(id);
    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }
    await training.update(req.body);
    res.status(200).json({ success: true, data: training });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (soft delete) a training (admin)
 */
exports.deleteTraining = async (req, res, next) => {
  try {
    const { id } = req.params;
    const training = await Training.findByPk(id);
    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }
    await training.destroy();
    res.status(200).json({ success: true, message: 'Training deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Add a video to a training
 */
exports.addVideo = async (req, res, next) => {
  try {
    const { trainingId } = req.params;
    const { title, description, videoUrl, thumbnail, duration, sortOrder, isFree } = req.body;

    const training = await Training.findByPk(trainingId);
    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const video = await TrainingVideo.create({
      trainingId,
      title,
      description,
      videoUrl,
      thumbnail,
      duration,
      sortOrder: sortOrder || 0,
      isFree: isFree || false,
    });

    res.status(201).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a video
 */
exports.updateVideo = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await TrainingVideo.findByPk(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    await video.update(req.body);
    res.status(200).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a video
 */
exports.deleteVideo = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await TrainingVideo.findByPk(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    await video.destroy();
    res.status(200).json({ success: true, message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a quiz for a training
 */
exports.createQuiz = async (req, res, next) => {
  try {
    const { trainingId } = req.params;
    const { title, description, passingScore, timeLimit } = req.body;

    const training = await Training.findByPk(trainingId);
    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const quiz = await Quiz.create({
      trainingId,
      title,
      description,
      passingScore: passingScore || 70,
      timeLimit,
      isActive: true,
    });

    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Add a question to a quiz
 */
exports.addQuizQuestion = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { question, options, correctOptionIndex, explanation, sortOrder } = req.body;

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const q = await QuizQuestion.create({
      quizId,
      question,
      options,
      correctOptionIndex,
      explanation,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({ success: true, data: q });
  } catch (error) {
    next(error);
  }
};

// ─── Worker routes ──────────────────────────────────────────────────

/**
 * Submit a quiz attempt (worker)
 */
exports.submitQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body; // array of selected option indices

    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: QuizQuestion }],
    });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    let correct = 0;
    const questions = quiz.QuizQuestions || [];
    const answered = answers || [];

    questions.forEach((q, index) => {
      // If the answer is an array, compare all; if a single value, compare directly
      const userAnswer = answered[index];
      if (userAnswer !== undefined && userAnswer === q.correctOptionIndex) {
        correct++;
      }
    });

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= quiz.passingScore;

    // Save attempt
    const attempt = await QuizAttempt.create({
      workerId: worker.id,
      quizId,
      score,
      passed,
      answers: answered,
      completedAt: new Date(),
    });

    // If passed, generate certificate if not already exists
    let certificate = null;
    if (passed) {
      const existing = await Certificate.findOne({
        where: { workerId: worker.id, trainingId: quiz.trainingId },
      });
      if (!existing) {
        // For now, generate a dummy certificate URL; in production, generate PDF
        const certUrl = `https://cooli.com/certificates/${worker.id}-${quiz.trainingId}.pdf`;
        certificate = await Certificate.create({
          workerId: worker.id,
          trainingId: quiz.trainingId,
          certificateUrl: certUrl,
          issuedAt: new Date(),
        });
      } else {
        certificate = existing;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        attempt,
        passed,
        score,
        certificate,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get worker's training progress (all attempts and certificates)
 */
exports.getMyProgress = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const attempts = await QuizAttempt.findAll({
      where: { workerId: worker.id },
      include: [{ model: Quiz }],
    });

    const certificates = await Certificate.findAll({
      where: { workerId: worker.id },
      include: [{ model: Training }],
    });

    // Optionally, get all trainings assigned to this worker
    const assignedTrainings = await Training.findAll({
      where: {
        applicableProfessions: { [Op.contains]: [worker.profession] },
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        attempts,
        certificates,
        assignedTrainings,
        stats: {
          totalTrainings: assignedTrainings.length,
          completedTrainings: certificates.length,
          averageScore: attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific certificate by ID (worker)
 */
exports.getCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const certificate = await Certificate.findOne({
      where: { id, workerId: worker.id },
      include: [{ model: Training }],
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    next(error);
  }
};