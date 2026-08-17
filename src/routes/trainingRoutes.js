const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── Worker & Admin ─────────────────────────────────────────────────
router.get('/', trainingController.getTrainings);
router.get('/my/progress', trainingController.getMyProgress);
router.get('/:id', idParamValidator, validate, trainingController.getTrainingById);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', isAdmin, trainingController.createTraining);
router.put('/:id', isAdmin, idParamValidator, validate, trainingController.updateTraining);
router.delete('/:id', isAdmin, idParamValidator, validate, trainingController.deleteTraining);

router.post('/:trainingId/videos', isAdmin, idParamValidator, validate, trainingController.addVideo);
router.put('/videos/:videoId', isAdmin, idParamValidator, validate, trainingController.updateVideo);
router.delete('/videos/:videoId', isAdmin, idParamValidator, validate, trainingController.deleteVideo);

router.post('/:trainingId/quiz', isAdmin, idParamValidator, validate, trainingController.createQuiz);
router.post('/quiz/:quizId/questions', isAdmin, idParamValidator, validate, trainingController.addQuizQuestion);

// Worker submits quiz
router.post('/quiz/:quizId/submit', idParamValidator, validate, trainingController.submitQuiz);

module.exports = router;