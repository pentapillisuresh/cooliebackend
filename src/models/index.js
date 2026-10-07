const sequelize = require('../config/database');

const Address = require('./Address');
const User = require('./User');
const Worker = require('./Worker');
const Category = require('./Category');
const Certificate = require('./Certificate');
const FAQ = require('./FAQ');
const Service = require('./Service');
const Booking = require('./Booking');
const BankDetail = require('./BankDetail');
const Job = require('./Job');
const Notification = require('./Notification');
const Document = require('./Document');
const Payment = require('./Payment');
const Review = require('./Review');
const Ticket = require('./Ticket');
const Training = require('./Training');
const TrainingVideo = require('./TrainingVideo');
const TicketReply = require('./TicketReply');
const Promotion = require('./Promotion');
const Quiz = require('./Quiz');
const QuizAttempt = require('./QuizAttempt');
const QuizQuestion = require('./QuizQuestion');
const WithdrawalRequest = require('./WithdrawalRequest');


// ============================================================
// USER ↔ WORKER
// One User has one Worker
// ============================================================

User.hasOne(Worker, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

Worker.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// WORKER ↔ BANK DETAIL
// One Worker has one BankDetail
// ============================================================

Worker.hasOne(BankDetail, {
  foreignKey: 'workerId',
  onDelete: 'CASCADE',
});

BankDetail.belongsTo(Worker, {
  foreignKey: 'workerId',
});


// ============================================================
// CATEGORY ↔ SERVICE
// One Category has many Services
// ============================================================

Category.hasMany(Service, {
  foreignKey: 'categoryId',
  onDelete: 'CASCADE',
});

Service.belongsTo(Category, {
  foreignKey: 'categoryId',
});


// ============================================================
// USER ↔ BOOKING
// One User has many Bookings
// ============================================================

User.hasMany(Booking, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

Booking.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// SERVICE ↔ BOOKING
// One Service has many Bookings
// ============================================================

Service.hasMany(Booking, {
  foreignKey: 'serviceId',
});

Booking.belongsTo(Service, {
  foreignKey: 'serviceId',
});


// ============================================================
// BOOKING ↔ JOB
// One Booking has one Job
// ============================================================

Booking.hasOne(Job, {
  foreignKey: 'bookingId',
  onDelete: 'CASCADE',
});

Job.belongsTo(Booking, {
  foreignKey: 'bookingId',
});


// ============================================================
// WORKER ↔ JOB
// One Worker has many Jobs
// ============================================================

Worker.hasMany(Job, {
  foreignKey: 'workerId',
});

Job.belongsTo(Worker, {
  foreignKey: 'workerId',
});


// ============================================================
// WORKER ↔ DOCUMENT
// One Worker has many Documents
// ============================================================

Worker.hasMany(Document, {
  foreignKey: 'workerId',
  onDelete: 'CASCADE',
});

Document.belongsTo(Worker, {
  foreignKey: 'workerId',
});


// ============================================================
// BOOKING ↔ PAYMENT
// One Booking has one Payment
// ============================================================

Booking.hasOne(Payment, {
  foreignKey: 'bookingId',
});

Payment.belongsTo(Booking, {
  foreignKey: 'bookingId',
});


// ============================================================
// USER ↔ PAYMENT
// One User has many Payments
// ============================================================

User.hasMany(Payment, {
  foreignKey: 'userId',
});

Payment.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// BOOKING ↔ REVIEW
// One Booking has one Review
// ============================================================

Booking.hasOne(Review, {
  foreignKey: 'bookingId',
});

Review.belongsTo(Booking, {
  foreignKey: 'bookingId',
});


// ============================================================
// USER ↔ REVIEW
// One User has many Reviews
// ============================================================

User.hasMany(Review, {
  foreignKey: 'userId',
});

Review.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// WORKER ↔ REVIEW
// One Worker has many Reviews
// ============================================================

Worker.hasMany(Review, {
  foreignKey: 'workerId',
});

Review.belongsTo(Worker, {
  foreignKey: 'workerId',
});


// ============================================================
// USER ↔ ADDRESS
// One User has many Addresses
// ============================================================

User.hasMany(Address, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

Address.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// USER ↔ TICKET
// One User has many Tickets
// ============================================================

User.hasMany(Ticket, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

Ticket.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// USER ↔ TICKET REPLY
// One User has many Ticket Replies
// ============================================================

User.hasMany(TicketReply, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});

TicketReply.belongsTo(User, {
  foreignKey: 'userId',
});


// ============================================================
// TICKET ↔ TICKET REPLY
// One Ticket has many Replies
// ============================================================

Ticket.hasMany(TicketReply, {
  foreignKey: 'ticketId',
  onDelete: 'CASCADE',
});

TicketReply.belongsTo(Ticket, {
  foreignKey: 'ticketId',
});


// ============================================================
// BOOKING ↔ TICKET
// One Booking has many Tickets
// ============================================================

Booking.hasMany(Ticket, {
  foreignKey: 'bookingId',
  onDelete: 'CASCADE',
});

Ticket.belongsTo(Booking, {
  foreignKey: 'bookingId',
});


// ============================================================
// TRAINING ↔ TRAINING VIDEO
// One Training has many Videos
// ============================================================

Training.hasMany(TrainingVideo, {
  foreignKey: 'trainingId',
  onDelete: 'CASCADE',
});

TrainingVideo.belongsTo(Training, {
  foreignKey: 'trainingId',
});


// ============================================================
// TRAINING ↔ QUIZ
// One Training has one Quiz
// ============================================================

Training.hasOne(Quiz, {
  foreignKey: 'trainingId',
  onDelete: 'CASCADE',
});

Quiz.belongsTo(Training, {
  foreignKey: 'trainingId',
});


// ============================================================
// QUIZ ↔ QUIZ QUESTION
// One Quiz has many Questions
// ============================================================

Quiz.hasMany(QuizQuestion, {
  foreignKey: 'quizId',
  onDelete: 'CASCADE',
});

QuizQuestion.belongsTo(Quiz, {
  foreignKey: 'quizId',
});


// ============================================================
// QUIZ ↔ QUIZ ATTEMPT
// One Quiz has many Attempts
// ============================================================

Quiz.hasMany(QuizAttempt, {
  foreignKey: 'quizId',
  onDelete: 'CASCADE',
});

QuizAttempt.belongsTo(Quiz, {
  foreignKey: 'quizId',
});


// ============================================================
// WORKER ↔ QUIZ ATTEMPT
// One Worker has many Quiz Attempts
// ============================================================

Worker.hasMany(QuizAttempt, {
  foreignKey: 'workerId',
  onDelete: 'CASCADE',
});

QuizAttempt.belongsTo(Worker, {
  foreignKey: 'workerId',
});


// ============================================================
// TRAINING ↔ CERTIFICATE
// One Training has many Certificates
// ============================================================

Training.hasMany(Certificate, {
  foreignKey: 'trainingId',
  onDelete: 'CASCADE',
});

Certificate.belongsTo(Training, {
  foreignKey: 'trainingId',
});


// ============================================================
// WORKER ↔ CERTIFICATE
// One Worker has many Certificates
// ============================================================

Worker.hasMany(Certificate, {
  foreignKey: 'workerId',
  onDelete: 'CASCADE',
});

Certificate.belongsTo(Worker, {
  foreignKey: 'workerId',
});

WithdrawalRequest.belongsTo(Worker, { foreignKey: 'workerId', as: 'Worker' });
WithdrawalRequest.belongsTo(User,   { foreignKey: 'userId',   as: 'User' });
Worker.hasMany(WithdrawalRequest,   { foreignKey: 'workerId', as: 'Withdrawals' });

// ============================================================
// EXPORT MODELS
// ============================================================

module.exports = {
  sequelize,

  // Users & Workers
  User,
  Worker,
  BankDetail,

  // Address
  Address,

  // Services
  Category,
  Service,

  // Bookings & Jobs
  Booking,
  Job,

  // Documents
  Document,

  // Payments
  Payment,

  // Reviews
  Review,

  // Notifications
  Notification,

  // Support
  Ticket,
  TicketReply,
  FAQ,

  // Promotions
  Promotion,

  // Training
  Training,
  TrainingVideo,

  // Quiz
  Quiz,
  QuizQuestion,
  QuizAttempt,

  // Certificates
  Certificate,
};