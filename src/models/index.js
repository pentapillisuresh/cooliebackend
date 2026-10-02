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

// User ↔ Worker (one-to-one)
User.hasOne(Worker, { foreignKey: 'userId', onDelete: 'CASCADE' });
Worker.belongsTo(User, { foreignKey: 'userId' });

Worker.hasOne(BankDetail, { foreignKey: 'workerId', onDelete: 'CASCADE' });
BankDetail.belongsTo(Worker, { foreignKey: 'workerId' });

// Category ↔ Service (one-to-many)
Category.hasMany(Service, { foreignKey: 'categoryId', onDelete: 'CASCADE' });
Service.belongsTo(Category, { foreignKey: 'categoryId' });

// User ↔ Booking (one-to-many)
User.hasMany(Booking, { foreignKey: 'userId', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'userId' });

// Service ↔ Booking (one-to-many)
Service.hasMany(Booking, { foreignKey: 'serviceId' });
Booking.belongsTo(Service, { foreignKey: 'serviceId' });

// Booking ↔ Job (one-to-one)
Booking.hasOne(Job, { foreignKey: 'bookingId', onDelete: 'CASCADE' });
Job.belongsTo(Booking, { foreignKey: 'bookingId' });

// Worker ↔ Job (one-to-many)
Worker.hasMany(Job, { foreignKey: 'workerId' });
Job.belongsTo(Worker, { foreignKey: 'workerId' });

// Worker ↔ Document (one-to-many)
Worker.hasMany(Document, { foreignKey: 'workerId', onDelete: 'CASCADE' });
Document.belongsTo(Worker, { foreignKey: 'workerId' });

// Booking ↔ Payment (one-to-one)
Booking.hasOne(Payment, { foreignKey: 'bookingId' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId' });

User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId' });

// Booking ↔ Review (one-to-one)
Booking.hasOne(Review, { foreignKey: 'bookingId' });
Review.belongsTo(Booking, { foreignKey: 'bookingId' });

// User ↔ Review (one-to-many)
User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

// Worker ↔ Review (one-to-many)
Worker.hasMany(Review, { foreignKey: 'workerId' });
Review.belongsTo(Worker, { foreignKey: 'workerId' });

User.hasMany(Address, { foreignKey: 'userId', onDelete: 'CASCADE' });
Address.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Ticket, { foreignKey: 'userId', onDelete: 'CASCADE' });
Ticket.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(TicketReply, { foreignKey: 'userId', onDelete: 'CASCADE' });
TicketReply.belongsTo(User, { foreignKey: 'userId' });

Ticket.hasMany(TicketReply, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
TicketReply.belongsTo(Ticket, { foreignKey: 'ticketId' });

Booking.hasMany(Ticket, { foreignKey: 'bookingId', onDelete: 'CASCADE' });
Ticket.belongsTo(Booking, { foreignKey: 'bookingId' });

module.exports = {
  sequelize,
  User,
  Worker,
  BankDetail,
  Category,
  Certificate,
  Service,
  Booking,
  Job,
  Notification,
  Document,
  FAQ,
  Ticket,
  TicketReply,
  Payment,
  Address,
  Review,
  Promotion,
  Quiz,
  Training,
  TrainingVideo,
  QuizAttempt,
  QuizQuestion
};