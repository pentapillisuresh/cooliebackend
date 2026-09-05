const sequelize = require('../config/database');

const User = require('./User');
const Worker = require('./Worker');
const Category = require('./Category');
const Service = require('./Service');
const Booking = require('./Booking');
const Job = require('./Job');
const Document = require('./Document');
const Payment = require('./Payment');
const Review = require('./Review');
const Notification = require('./Notification');
const Promotion = require('./Promotion');
const Coupon = require('./Coupon');

// User ↔ Worker (one-to-one)
User.hasOne(Worker, { foreignKey: 'userId', onDelete: 'CASCADE' });
Worker.belongsTo(User, { foreignKey: 'userId' });

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

// Booking ↔ Review (one-to-one)
Booking.hasOne(Review, { foreignKey: 'bookingId' });
Review.belongsTo(Booking, { foreignKey: 'bookingId' });

// User ↔ Review (one-to-many)
User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

// Worker ↔ Review (one-to-many)
Worker.hasMany(Review, { foreignKey: 'workerId' });
Review.belongsTo(Worker, { foreignKey: 'workerId' });

module.exports = {
  sequelize,
  User,
  Worker,
  Category,
  Service,
  Booking,
  Job,Notification,
  Document,
  Payment,
  Review,
  Coupon,
  Promotion,
};