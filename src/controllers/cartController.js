// src/controllers/cartController.js
const { Op } = require('sequelize');
const {
  Cart, CartItem, Service, Address,
  Booking, sequelize,
} = require('../models');
const { BOOKING_STATUS } = require('../utils/constants');
const {
  calculateUnitPrice, recalcCartTotals, GST_RATE,
} = require('../utils/cartPricing');

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

/**
 * Fetch or create the user's active cart.
 * Pass `transaction` when called from inside a tx.
 */
const getOrCreateActiveCart = async (userId, transaction = null) => {
  let cart = await Cart.findOne({
    where: { userId, status: 'active' },
    include: [{
      model: CartItem,
      as: 'Items',
      include: [{ model: Service, as: 'Service' }],
    }],
    transaction,
  });

  if (!cart) {
    cart = await Cart.create(
      { userId, status: 'active' },
      { transaction },
    );
    cart.Items = [];
  }
  return cart;
};

/**
 * Recalculate cart totals from its items and persist.
 * MUST be called with the same transaction that created/updated items,
 * otherwise the SELECT won't see uncommitted rows.
 */
const refreshTotals = async (cart, transaction = null) => {
  const items = await CartItem.findAll({
    where: { cartId: cart.id },
    transaction,
  });

  const totals = recalcCartTotals(cart, items);

  if (Object.values(totals).some((v) => Number.isNaN(v))) {
    throw new Error(`Invalid cart totals: ${JSON.stringify(totals)}`);
  }

  await cart.update(totals, { transaction });
  return cart;
};

/**
 * Standard "return the fresh cart" payload.
 */
const fetchFullCart = async (cartId, transaction = null) => {
  return Cart.findByPk(cartId, {
    include: [{
      model: CartItem,
      as: 'Items',
      include: [{ model: Service, as: 'Service' }],
    }],
    transaction,
  });
};

// ══════════════════════════════════════════════════════════════════
// GET /api/cart
// ══════════════════════════════════════════════════════════════════
exports.getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateActiveCart(req.user.id);

    const fresh = await fetchFullCart(cart.id);

    // Flag items whose service price changed since they were added
    const items = (fresh.Items || []).map((it) => {
      const currentUnit = calculateUnitPrice(it.Service, it.details);
      const stale = parseFloat(it.unitPrice) !== +currentUnit.toFixed(2);
      return {
        ...it.toJSON(),
        currentUnitPrice: +currentUnit.toFixed(2),
        priceChanged: stale,
      };
    });

    return res.json({
      success: true,
      data: { ...fresh.toJSON(), Items: items },
    });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/cart/items
// body: { serviceId, details, quantity?, specialInstructions?,
//         scheduledDate?, scheduledTime? }
// ══════════════════════════════════════════════════════════════════

exports.addItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      serviceId,
      details = {},
      quantity = 1,
      specialInstructions,
      scheduledDate,
      scheduledTime,

      // NEW — address can arrive at top level OR inside `details`
      addressId,
      address,
      latitude,
      longitude,
    } = req.body;

    if (!serviceId) {
      await t.rollback();
      return res.status(400).json({ error: 'serviceId is required' });
    }

    const service = await Service.findByPk(serviceId, { transaction: t });
    if (!service || service.deletedAt) {
      await t.rollback();
      return res.status(404).json({ error: 'Service not found' });
    }
    if (!service.isActive) {
      await t.rollback();
      return res.status(400).json({ error: 'Service is not available' });
    }

    const cart = await getOrCreateActiveCart(req.user.id, t);

    // Prefer top-level, then details, then cart default
    const itemAddressId = addressId ?? details.addressId ?? cart.addressId ?? null;
    const itemAddress = address ?? details.address ?? null;
    const itemLatitude = latitude ?? details.latitude ?? null;
    const itemLongitude = longitude ?? details.longitude ?? null;

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const unitPrice = +calculateUnitPrice(service, details).toFixed(2);
    const lineTotal = +(unitPrice * qty).toFixed(2);

    const item = await CartItem.create({
      cartId: cart.id,
      serviceId: service.id,
      details,
      quantity: qty,
      unitPrice,
      lineTotal,

      addressId: itemAddressId,
      address: itemAddress,
      latitude: itemLatitude,
      longitude: itemLongitude,

      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      specialInstructions: specialInstructions || null,
    }, { transaction: t });

    await refreshTotals(cart, t);
    await t.commit();

    const fresh = await fetchFullCart(cart.id);

    return res.status(201).json({
      success: true,
      data: fresh,
      addedItemId: item.id,
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// PUT /api/cart/items/:itemId
// body: { details?, quantity?, specialInstructions?,
//         scheduledDate?, scheduledTime? }
// ══════════════════════════════════════════════════════════════════
exports.updateItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      transaction: t,
    });
    if (!cart) {
      await t.rollback();
      return res.status(404).json({ error: 'No active cart' });
    }

    const item = await CartItem.findOne({
      where: { id: req.params.itemId, cartId: cart.id },
      include: [{ model: Service, as: 'Service' }],
      transaction: t,
    });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const details = req.body.details !== undefined ? req.body.details : item.details;
    const qty = req.body.quantity != null
      ? Math.max(1, parseInt(req.body.quantity, 10) || 1)
      : item.quantity;

    const unitPrice = +calculateUnitPrice(item.Service, details).toFixed(2);
    const lineTotal = +(unitPrice * qty).toFixed(2);

    // src/controllers/cartController.js — exports.updateItem
    const patch = {
      details,
      quantity: qty,
      unitPrice,
      lineTotal,
      specialInstructions: req.body.specialInstructions !== undefined
        ? req.body.specialInstructions : item.specialInstructions,
      scheduledDate: req.body.scheduledDate !== undefined
        ? req.body.scheduledDate : item.scheduledDate,
      scheduledTime: req.body.scheduledTime !== undefined
        ? req.body.scheduledTime : item.scheduledTime,
    };

    // NEW — address per item
    if (req.body.addressId !== undefined) patch.addressId = req.body.addressId || null;
    if (req.body.address !== undefined) patch.address = req.body.address || null;
    if (req.body.latitude !== undefined) patch.latitude = req.body.latitude || null;
    if (req.body.longitude !== undefined) patch.longitude = req.body.longitude || null;

    await item.update(patch, { transaction: t }); await refreshTotals(cart, t);
    await t.commit();

    const fresh = await fetchFullCart(cart.id);
    return res.json({ success: true, data: fresh });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// DELETE /api/cart/items/:itemId
// ══════════════════════════════════════════════════════════════════
exports.removeItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      transaction: t,
    });
    if (!cart) {
      await t.rollback();
      return res.status(404).json({ error: 'No active cart' });
    }

    const deleted = await CartItem.destroy({
      where: { id: req.params.itemId, cartId: cart.id },
      transaction: t,
    });
    if (!deleted) {
      await t.rollback();
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    await refreshTotals(cart, t);
    await t.commit();

    const fresh = await fetchFullCart(cart.id);
    return res.json({ success: true, data: fresh });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// DELETE /api/cart      (clear items, keep the cart)
// ══════════════════════════════════════════════════════════════════
exports.clearCart = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      transaction: t,
    });
    if (!cart) {
      await t.rollback();
      return res.json({ success: true, data: null });
    }

    await CartItem.destroy({ where: { cartId: cart.id }, transaction: t });

    await cart.update({
      subtotal: 0,
      discountAmount: 0,
      gstAmount: 0,
      convenienceCharges: 0,
      totalAmount: 0,
    }, { transaction: t });

    await t.commit();

    return res.json({
      success: true,
      data: { ...cart.toJSON(), Items: [] },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// PATCH /api/cart
// body: { addressId?, scheduledDate?, scheduledTime?,
//         bookingType?, promotionId?, notes? }
// ══════════════════════════════════════════════════════════════════
exports.updateCart = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      transaction: t,
    });
    if (!cart) {
      await t.rollback();
      return res.status(404).json({ error: 'No active cart' });
    }

    const allowed = [
      'addressId', 'scheduledDate', 'scheduledTime','convenienceCharges',
      'bookingType', 'promotionId', 'notes','discountAmount'
    ];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    // Validate address ownership when supplied
    if (patch.addressId) {
      const addr = await Address.findOne({
        where: { id: patch.addressId, userId: req.user.id },
        transaction: t,
      });
      if (!addr) {
        await t.rollback();
        return res.status(400).json({ error: 'Address not found' });
      }
    }

    await cart.update(patch, { transaction: t });
    await refreshTotals(cart, t);
    await t.commit();

    const fresh = await fetchFullCart(cart.id);
    return res.json({ success: true, data: fresh });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/cart/checkout
// body: { addressId?, scheduledDate?, scheduledTime?,
//         bookingType?, promotionId?, notes? }
// ══════════════════════════════════════════════════════════════════
exports.checkout = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      include: [{
        model: CartItem,
        as: 'Items',
        include: [{ model: Service, as: 'Service' }],
      }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!cart || !cart.Items || cart.Items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Merge checkout-time overrides with cart defaults
    const addressId = req.body.addressId ?? cart.addressId;
    const bookingType = req.body.bookingType ?? cart.bookingType ?? 'now';
    const scheduledDate = req.body.scheduledDate ?? cart.scheduledDate;
    const scheduledTime = req.body.scheduledTime ?? cart.scheduledTime;
    const promotionId = req.body.promotionId ?? cart.promotionId;
    const notes = req.body.notes ?? cart.notes;

    if (!addressId) {
      await t.rollback();
      return res.status(400).json({ error: 'addressId is required' });
    }

    let fallbackAddress = null;
    if (cart.addressId) {
      fallbackAddress = await Address.findOne({
        where: { id: cart.addressId, userId: req.user.id },
        transaction: t,
      });
    }

    // Also allow an explicit override from the body
    let overrideAddress = null;
    if (addressId) {
      overrideAddress = await Address.findOne({
        where: { id: addressId, userId: req.user.id },
        transaction: t,
      });
      if (!overrideAddress) {
        await t.rollback();
        return res.status(400).json({ error: 'Address not found' });
      }
    }

    if (!overrideAddress && !fallbackAddress) {
      await t.rollback();
      return res.status(400).json({ error: 'addressId is required' });
    }

    // Distribute cart-level discount + GST proportionally across bookings
    const cartSubtotal = parseFloat(cart.subtotal) || 0;
    const overrideDiscount = req.body.discountAmount !== undefined
      ? parseFloat(req.body.discountAmount)
      : null;

    // Later, when distributing the discount:
    const cartDiscount = overrideDiscount !== null
      ? overrideDiscount
      : parseFloat(cart.discountAmount) || 0; const cartConvenience = parseFloat(cart.convenienceCharges) || 0;

    const createdBookings = [];

    for (const item of cart.Items) {
      const line = parseFloat(item.lineTotal) || 0;
      const share = cartSubtotal > 0 ? line / cartSubtotal : 0;

      const itemDiscount = +(cartDiscount * share).toFixed(2);
      const taxable = Math.max(0, line - itemDiscount);
      const itemGst = +(taxable * GST_RATE).toFixed(2);
      const itemConvenience = +(cartConvenience * share).toFixed(2);
      const itemTotal = +(taxable + itemGst + itemConvenience).toFixed(2);
      let itemAddr = null;
      if (item.addressId) {
        itemAddr = await Address.findOne({
          where: { id: item.addressId, userId: req.user.id },
          transaction: t,
        });
      }
      const useAddr = itemAddr || overrideAddress || fallbackAddress;

      const booking = await Booking.create({
        userId: req.user.id,
        cartId: cart.id,    
        serviceId: item.serviceId,
        details: {
          ...(item.details || {}),
          serviceName: item.Service?.name,
          bookingType,
        },
        address: useAddr.address || useAddr.fullAddress || '',
        addressId: useAddr.id,
        latitude: useAddr.latitude,
        longitude: useAddr.longitude,
        scheduledDate: item.scheduledDate || scheduledDate,
        scheduledTime: item.scheduledTime || scheduledTime,
        servicePrice: +line.toFixed(2),
        GST: itemGst,
        convenianceCharges: itemConvenience,
        discountAmount: itemDiscount,
        totalAmount: itemTotal,
        status: BOOKING_STATUS?.PENDING || 'pending',
        paymentStatus: 'pending',
        specialInstructions: item.specialInstructions || notes || '',
        promotionId,
      }, { transaction: t });

      createdBookings.push(booking);
    }

    await cart.update({
      status: 'converted',
      addressId: overrideAddress?.id || fallbackAddress?.id || null,
      scheduledDate,
      scheduledTime,
      bookingType,
      promotionId,
      notes,
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({
      success: true,
      data: {
        cartId: cart.id,
        bookings: createdBookings,
        totalAmount: parseFloat(cart.totalAmount) || 0,
      },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};