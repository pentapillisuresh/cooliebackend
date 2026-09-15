const { Notification, User } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');
const { USER_ROLES } = require('../utils/constants');
const { sendPushNotification, sendMulticastNotification } = require('../services/notification/fcm');

/**
 * Get all notifications for the authenticated user (with pagination)
 */
exports.getMyNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const data = await Notification.findAndCountAll({
      where,
      order: [['sentAt', 'DESC']],
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
 * Mark a single notification as read
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      where: { id, userId: req.user.id },
    });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    await notification.update({ isRead: true, readAt: new Date() });
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification (soft delete)
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      where: { id, userId: req.user.id },
    });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    await notification.destroy();
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Send notification to a specific user or broadcast to all users
 * Also sends FCM push notification if user(s) have device tokens
 */
exports.sendNotification = async (req, res, next) => {
  try {
    const { userId, title, body, data, type, broadcast } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    if (broadcast) {
      // Broadcast to all users
      const users = await User.findAll({ attributes: ['id', 'fcmToken'] });
      const fcmTokens = users.map(u => u.fcmToken).filter(t => t);
      const notifications = users.map(u => ({
        userId: u.id,
        title,
        body,
        data: data || {},
        type: type || 'system',
        sentAt: new Date(),
      }));
      await Notification.bulkCreate(notifications);

      // Send push notifications
      if (fcmTokens.length) {
        await sendMulticastNotification(fcmTokens, title, body, data);
      }

      return res.status(201).json({ success: true, message: `Broadcast sent to ${users.length} users` });
    } else {
      // Send to a specific user
      if (!userId) {
        return res.status(400).json({ error: 'userId is required when not broadcasting' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const notification = await Notification.create({
        userId: user.id,
        title,
        body,
        data: data || {},
        type: type || 'system',
        sentAt: new Date(),
      });

      // Send push notification if user has a device token
      if (user.fcmToken) {
        await sendPushNotification(user.fcmToken, title, body, data);
      }

      return res.status(201).json({ success: true, data: notification });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Create notification and send push (used internally by other controllers)
 */
exports.createNotification = async (userId, title, body, data = {}, type = 'system') => {
  try {
    // Create in DB
    const notification = await Notification.create({
      userId,
      title,
      body,
      data,
      type,
      sentAt: new Date(),
    });

    // Send push notification if user has token
    const user = await User.findByPk(userId, { attributes: ['fcmToken'] });
    if (user && user.fcmToken) {
      console.log("worker token::",user.fcmToken)
      await sendPushNotification(user.fcmToken, title, body, data);
    }
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};