const { Address } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');

// ─── Get all addresses for user ──────────────────────────────
exports.getMyAddresses = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const data = await Address.findAndCountAll({
      where: { userId: req.user.id },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

// ─── Get single address ──────────────────────────────────────
exports.getAddressById = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ error: 'Address not found' });
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

// ─── Create address ──────────────────────────────────────────
exports.createAddress = async (req, res, next) => {
  try {
    const {
      label,
      country,
      latitude,
      address,
      longitude,
      placeId,
      isDefault,
    } = req.body;


    // If this is marked default, unset others
    if (isDefault) {
      await Address.update(
        { isDefault: false },
        { where: { userId: req.user.id } }
      );
    }

    const addressDetails = await Address.create({
      userId: req.user.id,
      label,
      address,
      country: country || 'India',
      latitude,
      longitude,
      placeId,
      isDefault: !!isDefault,
    });

    res.status(201).json({ success: true, data: addressDetails });
  } catch (error) {
    next(error);
  }
};

// ─── Update address ──────────────────────────────────────────
exports.updateAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ error: 'Address not found' });

    const updates = req.body;

    if (updates.isDefault === true) {
      await Address.update(
        { isDefault: false },
        { where: { userId: req.user.id } }
      );
    }

    await address.update(updates);
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

// ─── Delete address ──────────────────────────────────────────
exports.deleteAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ error: 'Address not found' });

    await address.destroy();
    res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (error) {
    next(error);
  }
};

// ─── Set default address ─────────────────────────────────────
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!address) return res.status(404).json({ error: 'Address not found' });

    await Address.update(
      { isDefault: false },
      { where: { userId: req.user.id } }
    );
    await address.update({ isDefault: true });

    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};