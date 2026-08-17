const { User } = require('../models');
const bcrypt = require('bcryptjs');

// ─── User self-profile ────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] }
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    // Fields that must NEVER be updated via this endpoint
    const forbidden = [
      'id', 'password', 'otp', 'otpExpiry',
      'createdAt', 'updatedAt', 'deletedAt',
      'role', 'isVerified', 'fcmToken', 'deviceType'
    ];

    // Build updates object from req.body, excluding forbidden fields
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (!forbidden.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // If no valid fields to update, return error
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Perform update
    await req.user.update(updates);

    // Fetch updated user without sensitive fields
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const isValid = await bcrypt.compare(oldPassword, req.user.password);
    if (!isValid) return res.status(400).json({ error: 'Incorrect old password' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await req.user.update({ password: hashed });
    res.status(200).json({ success: true, message: 'Password updated' });
  } catch (error) { next(error); }
};

// ─── Admin CRUD ──────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, role } = req.query;
    const { getPagination, getPagingData } = require('../utils/helpers');
    const { offset, limit: lim } = getPagination(page, limit);
    const where = {};
    if (role) where.role = role;
    const data = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });
    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) { next(error); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
      include: [{ model: Worker }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, mobile, role, isVerified } = req.body;
    await user.update({ name, mobile, role, isVerified });
    const updated = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] }
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.destroy();
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) { next(error); }
};