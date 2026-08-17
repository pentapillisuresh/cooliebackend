const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Payment, Booking } = require('../models');
const { PAYMENT_STATUS, BOOKING_STATUS } = require('../utils/constants');

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
    const { bookingId } = req.params;

    // Find booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization: only the booking owner or admin
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if payment already exists and is successful
    const existingPayment = await Payment.findOne({ where: { bookingId, status: PAYMENT_STATUS.PAID } });
    if (existingPayment) {
      return res.status(400).json({ error: 'Payment already completed for this booking' });
    }

    // Amount in paise (Razorpay expects smallest currency unit)
    const amountInPaise = Math.round(booking.totalAmount * 100);

    // Create Razorpay order
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `booking_${bookingId}`,
      payment_capture: 1, // Auto-capture
      notes: {
        bookingId: bookingId.toString(),
        userId: req.user.id.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Create payment record with pending status
    const payment = await Payment.create({
      bookingId,
      amount: booking.totalAmount,
      currency: 'INR',
      paymentMethod: 'razorpay',
      status: PAYMENT_STATUS.PENDING,
      razorpayOrderId: order.id,
      gatewayResponse: order,
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        paymentId: payment.id,
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
exports.verifyPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification parameters' });
    }

    // Find the payment record
    const payment = await Payment.findOne({
      where: { bookingId, razorpayOrderId: razorpay_order_id },
    });
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      // Update payment status to failed
      await payment.update({
        status: PAYMENT_STATUS.FAILED,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        gatewayResponse: { ...payment.gatewayResponse, razorpay_payment_id, razorpay_signature },
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Payment successful
    await payment.update({
      status: PAYMENT_STATUS.PAID,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paidAt: new Date(),
      transactionId: razorpay_payment_id,
      gatewayResponse: { ...payment.gatewayResponse, razorpay_payment_id, razorpay_signature },
    });

    // Update booking status to completed (or keep as payment-pending if service not yet done)
    // Since payment is done, set booking status to completed (or payment-pending depending on workflow)
    // Here we set to completed as payment confirms the job is done
    const booking = await Booking.findByPk(bookingId);
    if (booking) {
      await booking.update({ status: BOOKING_STATUS.COMPLETED, paymentStatus: PAYMENT_STATUS.PAID });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { paymentId: payment.id, status: PAYMENT_STATUS.PAID },
    });
  } catch (error) {
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