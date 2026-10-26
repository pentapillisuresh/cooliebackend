const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Payment, Booking, User, Worker, Job, Service, Category, Cart, sequelize } = require('../models');
const { PAYMENT_STATUS, BOOKING_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');
const { getPagination, getPagingData } = require('../utils/helpers');
const { assignWorkerToBooking } = require('../utils/workerAssignment');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order for a booking
 */
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { cartId } = req.params;

    if (!cartId) {
      return res.status(400).json({ error: 'cartId is required' });
    }
    // Find booking
    const cart = await Cart.findByPk(cartId);
    if (!cartId) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Authorization: only the booking owner or admin
    if (req.user.role !== 'admin' && cart.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 3. Cart must have been converted into bookings
    if (cart.status !== 'converted') {
      return res.status(400).json({
        error: 'Cart has not been checked out yet',
        status: cart.status,
      });
    }

    // Check if payment already exists and is successful
    const existingPayment = await Payment.findOne({
      where: { bookingId: null, userId: req.user.id, razorpayOrderId: { [Op.ne]: null } },
      include: [],
    });
    // The above is awkward — better to check by a dedicated field.
    // Simplest: look for a Payment tied to any booking of this cart.
    const bookings = await Booking.findAll({
      where: { cartId: cart.id },
      attributes: ['id', 'totalAmount', 'paymentStatus', 'scheduledDate', 'scheduledTime'],
    });
    if (!bookings.length) {
      return res.status(400).json({ error: 'No bookings found for this cart' });
    }

    const paidBooking = bookings.find((b) => b.paymentStatus === 'paid');
    if (paidBooking) {
      return res.status(400).json({ error: 'Payment already completed for this cart' });
    }

    // 5. Total = sum of the (already discounted + GST'd) booking totals
    const totalAmount = bookings.reduce(
      (sum, b) => sum + (parseFloat(b.totalAmount) || 0),
      0,
    );

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid cart total' });
    }

    // Amount in paise (Razorpay expects smallest currency unit)
    const amountInPaise = Math.round(totalAmount * 100);

    // Create Razorpay order
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `cart_${cartId}`,

      notes: {
        cartId: String(cart.id),
        userId: String(req.user.id),
        bookingIds: bookings.map((b) => b.id).join(','),
      },
    };

    const order = await razorpay.orders.create(options);
    const primaryBooking = bookings[0];

    // Create payment record with pending status
    const payment = await Payment.create({
      bookingId: primaryBooking.id,
      userId: Number(req.user.id),
      amount: cart.totalAmount,
      currency: 'INR',
      paymentMethod: 'razorpay',
      status: PAYMENT_STATUS.PENDING,
      razorpayOrderId: order.id,
      gatewayResponse: {
        ...order,
        cartId: cart.id,
        bookingIds: bookings.map((b) => b.id),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        paymentId: payment.id,
        cartId: cart.id,
        bookingIds: bookings.map((b) => b.id),
      },
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    next(error);
  }
};

/**
 * Verify payment signature after user completes payment
 */
// src/controllers/paymentController.js
exports.verifyPayment = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const cartId = Number(req.params.cartId);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!cartId) {
      await t.rollback();
      return res.status(400).json({ error: 'cartId is required' });
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await t.rollback();
      return res.status(400).json({ error: 'Missing payment verification parameters' });
    }

    // ── 1. Find the Payment ───────────────────────────────────
    // NOTE: no lock here. The update below is atomic on its own;
    // we don't need to hold a row lock just to read.
    const payment = await Payment.findOne({
      where: { razorpayOrderId: razorpay_order_id },
      transaction: t,
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // ── 2. Idempotency — already verified? return success ─────
    if (payment.status === PAYMENT_STATUS.PAID) {
      await t.rollback(); // nothing to do, release the connection
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          paymentId: payment.id,
          status: PAYMENT_STATUS.PAID,
          cartId,
          alreadyVerified: true,
        },
      });
    }

    // ── 3. Verify signature ───────────────────────────────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const signatureValid =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature),
      );

    const mergeGatewayResponse = (existing, additions) => {
      let base = {};
      if (existing) {
        if (typeof existing === 'string') {
          try { base = JSON.parse(existing); } catch { base = {}; }
        } else {
          base = existing;
        }
      }
      return { ...base, ...additions };
    };

    if (!signatureValid) {
      await payment.update(
        {
          status: PAYMENT_STATUS.FAILED,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          gatewayResponse: mergeGatewayResponse(payment.gatewayResponse, {
            razorpay_payment_id,
            razorpay_signature,
            failureReason: 'Signature mismatch',
          }),
        },
        { transaction: t },
      );
      await t.commit();
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // ── 4. Mark the payment as paid ───────────────────────────
    await payment.update(
      {
        status: PAYMENT_STATUS.PAID,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paidAt: new Date(),
        transactionId: razorpay_payment_id,
        gatewayResponse: mergeGatewayResponse(payment.gatewayResponse, {
          razorpay_payment_id,
          razorpay_signature,
          verifiedAt: new Date().toISOString(),
        }),
      },
      { transaction: t },
    );

    // ── 5. Find every booking tied to this cart ───────────────
    let bookings = await Booking.findAll({
      where: { cartId },
      transaction: t,
    });

    if (!bookings.length && payment.bookingId) {
      const fallback = await Booking.findByPk(payment.bookingId, { transaction: t });
      if (fallback) bookings = [fallback];
    }

    if (bookings.length) {
      await Booking.update(
        {
          paymentStatus: PAYMENT_STATUS.PAID,
          status: BOOKING_STATUS.PAYMENT_PAID || 'payment-paid',
        },
        {
          where: { id: { [Op.in]: bookings.map((b) => b.id) } },
          transaction: t,
        },
      );
    }

    // ── 6. Commit BEFORE worker assignment ────────────────────
    await t.commit();

    // ── 7. Fire-and-forget assignment ─────────────────────────
    if (bookings.length) {
      const assignTasks = bookings.map(async (b) => {
        try {
          const service = await Service.findByPk(b.serviceId, {
            include: [{ model: Category }],
          });
          const location = { latitude: b.latitude, longitude: b.longitude };
          const job = await assignWorkerToBooking(b, service, location);
          if (job) {
            // ✅ Worker assigned — flip the booking status now
            await b.update({
              status: BOOKING_STATUS.ASSIGNED || 'assigned',
            });
            console.log(`✅ Worker ${job.workerId} assigned to booking ${b.id}`);
          } else {
            console.log(`⚠️ No available worker for booking ${b.id}`);
          }
        } catch (err) {
          console.error(`Auto-assignment error for booking ${b.id}:`, err);
        }
      });
      Promise.allSettled(assignTasks).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: payment.id,
        status: PAYMENT_STATUS.PAID,
        cartId,
        bookingIds: bookings.map((b) => b.id),
      },
    });
  } catch (error) {
    try { await t.rollback(); } catch (_) {}

    // ── Handle lock timeout with a single retry ───────────────
    if (error?.original?.code === 'ER_LOCK_WAIT_TIMEOUT') {
      console.warn('⚠️ Lock timeout on verify — retrying once after 500ms');
      await new Promise((r) => setTimeout(r, 500));
      return exports.verifyPayment(req, res, next);
    }

    console.error('verifyPayment error:', error);
    next(error);
  }
};

/**
 * Get payment status for a booking
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const payment = await Payment.findOne({
      where: { bookingId },
      order: [['createdAt', 'DESC']],
    });

    if (!payment) {
      return res.status(404).json({ error: 'No payment found for this booking' });
    }

    // Authorization: only booking owner or admin
    const booking = await Booking.findByPk(bookingId);
    if (!booking || (req.user.role !== 'admin' && booking.userId !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paidAt,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook handler for Razorpay events
 * (to be called by Razorpay server, no authentication)
 */
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    // Handle different events
    if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      // Find payment record
      const payment = await Payment.findOne({ where: { razorpayOrderId: orderId } });
      if (!payment) {
        console.error(`Payment record not found for order: ${orderId}`);
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Update payment status if not already done
      if (payment.status !== PAYMENT_STATUS.PAID) {
        await payment.update({
          status: PAYMENT_STATUS.PAID,
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
          transactionId: paymentId,
          webhookStatus: 'processed',
          gatewayResponse: { ...payment.gatewayResponse, webhook: req.body },
        });

        // Update booking status
        const booking = await Booking.findByPk(payment.bookingId);
        if (booking) {
          await booking.update({ status: BOOKING_STATUS.COMPLETED, paymentStatus: PAYMENT_STATUS.PAID });
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const payment = await Payment.findOne({ where: { razorpayOrderId: orderId } });
      if (payment) {
        await payment.update({
          status: PAYMENT_STATUS.FAILED,
          webhookStatus: 'processed',
          gatewayResponse: { ...payment.gatewayResponse, webhook: req.body },
        });
      }
    } else {
      // Handle other events if needed
      console.log(`Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Refund a payment (admin only)
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findOne({
      where: { bookingId, status: PAYMENT_STATUS.PAID },
    });

    if (!payment) {
      return res.status(404).json({ error: 'No successful payment found for this booking' });
    }

    if (!payment.razorpayPaymentId) {
      return res.status(400).json({ error: 'No Razorpay payment ID found' });
    }

    // Initiate refund via Razorpay
    const refundOptions = {
      payment_id: payment.razorpayPaymentId,
      amount: Math.round(payment.amount * 100), // in paise
      notes: { bookingId: bookingId.toString(), reason: reason || 'Admin initiated refund' },
    };

    const refund = await razorpay.payments.refund(refundOptions);

    // Update payment status
    await payment.update({
      status: PAYMENT_STATUS.REFUNDED,
      gatewayResponse: { ...payment.gatewayResponse, refund },
    });

    res.status(200).json({
      success: true,
      message: 'Refund initiated',
      data: refund,
    });
  } catch (error) {
    console.error('Refund error:', error);
    next(error);
  }
};

exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { page, limit, status, fromDate, toDate } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (fromDate && toDate) {
      where.paidAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.paidAt = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.paidAt = { [Op.lte]: toDate };
    }

    // Get bookings for the user
    const bookings = await Booking.findAll({
      where: { userId: req.user.id },
      attributes: ['id'],
    });
    const bookingIds = bookings.map(b => b.id);
    if (bookingIds.length === 0) {
      return res.status(200).json({ success: true, data: { totalItems: 0, items: [] } });
    }
    where.bookingId = { [Op.in]: bookingIds };

    const data = await Payment.findAndCountAll({
      where,
      include: [
        { model: Booking, include: [{ model: Service }] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });
    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Admin get payment report ────────────────────────────────────
exports.getPaymentReport = async (req, res, next) => {
  try {
    const { fromDate, toDate, status } = req.query;
    const where = {};
    if (status) where.status = status;
    if (fromDate && toDate) {
      where.createdAt = { [Op.between]: [fromDate, toDate] };
    }

    const payments = await Payment.findAll({
      where,
      include: [
        { model: Booking, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Calculate summaries
    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalPaid: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalPending: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalFailed: payments.filter(p => p.status === 'failed').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalRefunded: payments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + parseFloat(p.amount), 0),
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Get payment methods for user ────────────────────────────────
exports.getPaymentMethods = async (req, res, next) => {
  try {
    // This could return saved cards, UPI IDs, etc.
    // For now, return available methods
    const methods = [
      { id: 'razorpay', name: 'Razorpay', type: 'gateway', icon: 'razorpay' },
      { id: 'upi', name: 'UPI', type: 'gateway', icon: 'upi' },
      { id: 'cash', name: 'Cash', type: 'offline', icon: 'cash' },
    ];
    res.status(200).json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Initiate refund (extended) ──────────────────────────────────
exports.initiateRefund = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason, amount } = req.body;

    const payment = await Payment.findOne({
      where: { bookingId, status: PAYMENT_STATUS.PAID },
    });
    if (!payment) {
      return res.status(404).json({ error: 'No successful payment found' });
    }
    if (!payment.razorpayPaymentId) {
      return res.status(400).json({ error: 'Razorpay payment ID not found' });
    }

    const refundAmount = amount ? Math.round(parseFloat(amount) * 100) : Math.round(parseFloat(payment.amount) * 100);

    const refundOptions = {
      payment_id: payment.razorpayPaymentId,
      amount: refundAmount,
      notes: {
        bookingId: bookingId.toString(),
        reason: reason || 'Refund requested',
      },
    };

    const refund = await razorpay.payments.refund(refundOptions);

    await payment.update({
      status: PAYMENT_STATUS.REFUNDED,
      gatewayResponse: { ...payment.gatewayResponse, refund },
    });

    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: refund,
    });
  } catch (error) {
    console.error('Refund error:', error);
    next(error);
  }
};