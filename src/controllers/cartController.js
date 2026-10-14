const { Op, fn, col } = require('sequelize');
const {
  Cart, CartItem, Service, Address, User,
  Booking, Job, sequelize,
} = require('../models');
const { BOOKING_STATUS, JOB_STATUS } = require('../utils/constants');
const {
  calculateUnitPrice, recalcCartTotals, GST_RATE,
} = require('../utils/cartPricing');

// ─── Helper: fetch or create the user's active cart ────────────────
const getOrCreateActiveCart = async (userId) => {
  let cart = await Cart.findOne({
    where: { userId, status: 'active' },
    include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
  });
  if (!cart) {
    cart = await Cart.create({ userId, status: 'active' });
    cart.Items = [];
  }
  return cart;
};

// ─── Helper: re-recalc and persist totals ─────────────────────────
const refreshTotals = async (cart) => {
  const items = await CartItem.findAll({ where: { cartId: cart.id } });
  const totals = recalcCartTotals(cart, items);
  await cart.update(totals);
  return cart;
};

// ══════════════════════════════════════════════════════════════════
// GET /api/cart
// ══════════════════════════════════════════════════════════════════
exports.getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateActiveCart(req.user.id);
    const fresh = await Cart.findByPk(cart.id, {
      include: [{
        model: CartItem, as: 'Items',
        include: [{ model: Service, as: 'Service' }],
      }],
    });

    // If any item's service price changed, flag it so the UI can warn.
    const items = fresh.Items.map((it) => {
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
      serviceId, details = {}, quantity = 1,
      specialInstructions, scheduledDate, scheduledTime,
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

    const cart = await getOrCreateActiveCart(req.user.id);
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
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      specialInstructions: specialInstructions || null,
    }, { transaction: t });

    await refreshTotals(cart);
    await t.commit();

    const fresh = await Cart.findByPk(cart.id, {
      include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
    });
    return res.status(201).json({ success: true, data: fresh, addedItemId: item.id });
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

    const details = req.body.details ?? item.details;
    const qty = req.body.quantity != null
      ? Math.max(1, parseInt(req.body.quantity, 10) || 1)
      : item.quantity;

    const unitPrice = +calculateUnitPrice(item.Service, details).toFixed(2);
    const lineTotal = +(unitPrice * qty).toFixed(2);

    await item.update({
      details,
      quantity: qty,
      unitPrice,
      lineTotal,
      specialInstructions: req.body.specialInstructions ?? item.specialInstructions,
      scheduledDate: req.body.scheduledDate ?? item.scheduledDate,
      scheduledTime: req.body.scheduledTime ?? item.scheduledTime,
    }, { transaction: t });

    await refreshTotals(cart);
    await t.commit();

    const fresh = await Cart.findByPk(cart.id, {
      include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
    });
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
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id, status: 'active' } });
    if (!cart) return res.status(404).json({ error: 'No active cart' });

    const deleted = await CartItem.destroy({
      where: { id: req.params.itemId, cartId: cart.id },
    });
    if (!deleted) return res.status(404).json({ error: 'Item not found in cart' });

    await refreshTotals(cart);

    const fresh = await Cart.findByPk(cart.id, {
      include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
    });
    return res.json({ success: true, data: fresh });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// DELETE /api/cart      (clear all items, keep cart)
// ══════════════════════════════════════════════════════════════════
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id, status: 'active' } });
    if (!cart) return res.json({ success: true, data: null });

    await CartItem.destroy({ where: { cartId: cart.id } });
    await cart.update({
      subtotal: 0, discountAmount: 0, gstAmount: 0,
      convenienceCharges: 0, totalAmount: 0,
    });

    return res.json({ success: true, data: { ...cart.toJSON(), Items: [] } });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// PATCH /api/cart          (update cart-level fields: address, schedule,
//                           bookingType, notes, promotionId)
// ══════════════════════════════════════════════════════════════════
exports.updateCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id, status: 'active' } });
    if (!cart) return res.status(404).json({ error: 'No active cart' });

    const allowed = [
      'addressId', 'scheduledDate', 'scheduledTime',
      'bookingType', 'promotionId', 'notes',
    ];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    // Validate address ownership when provided
    if (patch.addressId) {
      const addr = await Address.findOne({
        where: { id: patch.addressId, userId: req.user.id },
      });
      if (!addr) return res.status(400).json({ error: 'Address not found' });
    }

    await cart.update(patch);
    await refreshTotals(cart);

    const fresh = await Cart.findByPk(cart.id, {
      include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
    });
    return res.json({ success: true, data: fresh });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/cart/checkout
// body: { addressId?, scheduledDate?, scheduledTime?,
//         bookingType?, promotionId?, notes? }
//
// Creates one Booking per CartItem, marks cart as converted, and
// returns the created bookings. Payment is intentionally NOT taken
// here — reuse your existing Razorpay flow on each booking.
// ══════════════════════════════════════════════════════════════════
exports.checkout = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id, status: 'active' },
      include: [{ model: CartItem, as: 'Items', include: [{ model: Service, as: 'Service' }] }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!cart || !cart.Items.length) {
      await t.rollback();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Merge in checkout-time overrides
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

    const address = await Address.findOne({
      where: { id: addressId, userId: req.user.id },
      transaction: t,
    });
    if (!address) {
      await t.rollback();
      return res.status(400).json({ error: 'Address not found' });
    }

    // Snapshot discount/GST per booking proportionally from cart
    const cartSubtotal = parseFloat(cart.subtotal) || 0;
    const cartDiscount = parseFloat(cart.discountAmount) || 0;

    const createdBookings = [];

    for (const item of cart.Items) {
      const line = parseFloat(item.lineTotal) || 0;
      const share = cartSubtotal > 0 ? line / cartSubtotal : 0;

      const itemDiscount = +(cartDiscount * share).toFixed(2);
      const taxable = Math.max(0, line - itemDiscount);
      const itemGst = +(taxable * GST_RATE).toFixed(2);
      const itemConvenience = +(parseFloat(cart.convenienceCharges || 0) * share).toFixed(2);
      const itemTotal = +(taxable + itemGst + itemConvenience).toFixed(2);

      const booking = await Booking.create({
        userId: req.user.id,
        serviceId: item.serviceId,
        details: {
          ...item.details,
          serviceName: item.Service?.name,
          categoryName: item.Service?.category?.name,
          bookingType,
        },
        address: address.address || address.fullAddress || '',
        addressId: address.id,
        latitude: address.latitude,
        longitude: address.longitude,
        scheduledDate: item.scheduledDate || scheduledDate,
        scheduledTime: item.scheduledTime || scheduledTime,
        servicePrice: +line.toFixed(2),
        GST: itemGst,
        convenianceCharges: itemConvenience,
        discountAmount: itemDiscount,
        totalAmount: itemTotal,
        status: BOOKING_STATUS.PENDING || 'pending',
        paymentStatus: 'pending',
        specialInstructions: item.specialInstructions || notes || '',
        promotionId,
      }, { transaction: t });

      createdBookings.push(booking);
    }

    await cart.update({
      status: 'converted',
      addressId,
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