const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── Worker & Admin ─────────────────────────────────────────────────
router.get('/', trainingController.getTrainings);
router.get('/my/progress', trainingController.getMyProgress);
router.get('/:id', idParamValidator,  trainingController.getTrainingById);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', isAdmin, trainingController.createTraining);
router.put('/:id', isAdmin, idParamValidator,  trainingController.updateTraining);
router.delete('/:id', isAdmin, idParamValidator,  trainingController.deleteTraining);

router.post('/:trainingId/videos', isAdmin, idParamValidator,  trainingController.addVideo);
router.put('/videos/:videoId', isAdmin, idParamValidator,  trainingController.updateVideo);
router.delete('/videos/:videoId', isAdmin, idParamValidator,  trainingController.deleteVideo);

router.post('/:trainingId/quiz', isAdmin, idParamValidator,  trainingController.createQuiz);
router.post('/quiz/:quizId/questions', isAdmin, idParamValidator,  trainingController.addQuizQuestion);

// Worker submits quiz
router.post('/quiz/:quizId/submit', idParamValidator,  trainingController.submitQuiz);

module.exports = router;