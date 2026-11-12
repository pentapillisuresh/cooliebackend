const crypto = require('crypto');
const axios = require('axios');
const { User, sequelize } = require('../models');

const OTP_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

// ── Helpers ────────────────────────────────────────────────────────
const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const sendDeletionSms = async (phoneDigits, otp) => {
  const url = 'http://whatsapp.esotericprojects.com/api/sendmsg.php';
  const text = `Your Coolie account deletion OTP is ${otp}. It is valid for 5 minutes. Do not share this OTP with anyone.`;

  try {
    const response = await axios.get(url, {
      params: {
        user: 'sahills_ent08',
        pass: '123456',
        sender: 'SAHENP',
        phone: phoneDigits,
        text,
        priority: 'ndnd',
        stype: 'normal',
      },
      timeout: 10000,
    });
    return { ok: true, data: response.data };
  } catch (error) {
    console.error('Deletion SMS error:', error.message);
    return { ok: false, error };
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/account/delete/send-otp
// body: { phoneNumber: "+919742093535" }
// ══════════════════════════════════════════════════════════════════

exports.sendOtp = async (req, res, next) => {
  try {
    const digits = normalizePhone(req.body?.phoneNumber);
    if (!digits || digits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid registered phone number.',
      });
    }

    // Match user by any stored form: "9742093535" or "+919742093535" or "919742093535"
    const last10 = digits.slice(-10);
    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn('RIGHT', sequelize.col('mobile'), 10),
        last10,
      ),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number.',
      });
    }

    if (user.isActive === false) {
      return res.status(409).json({
        success: false,
        message: 'This account is already deactivated.',
      });
    }

    // Generate OTP and store its hash on the user row
    const otp = generateOtp();
    await user.update({
      deletionOtp: hashOtp(otp),
      deletionOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    // Send SMS via your SHAHILLS gateway
    const sms = await sendDeletionSms(last10, otp);

    if (!sms.ok) {
      await user.update({
        deletionOtp: null,
        deletionOtpExpiresAt: null,
      });
      return res.status(502).json({
        success: false,
        message: 'Could not send OTP. Please try again in a moment.',
      });
    }

    return res.json({
      success: true,
      message: 'OTP sent to your registered mobile number.',
      requestId: user.id, // frontend expects this field
    });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/account/delete/verify-otp
// body: { phoneNumber, requestId, otp }
// ══════════════════════════════════════════════════════════════════

exports.verifyOtp = async (req, res, next) => {
  try {
    const digits = normalizePhone(req.body?.phoneNumber);
    const { otp } = req.body || {};

    if (!digits || !/^\d{6}$/.test(String(otp || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Enter the valid 6-digit OTP.',
      });
    }

    const last10 = digits.slice(-10);
    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn('RIGHT', sequelize.col('mobile'), 10),
        last10,
      ),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number.',
      });
    }

    if (!user.deletionOtp || !user.deletionOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No OTP request found. Please request a new OTP.',
      });
    }

    if (new Date(user.deletionOtpExpiresAt) < new Date()) {
      await user.update({
        deletionOtp: null,
        deletionOtpExpiresAt: null,
      });
      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new one.',
      });
    }

    if ((user.deletionOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      await user.update({
        deletionOtp: null,
        deletionOtpExpiresAt: null,
        deletionOtpAttempts: 0,
      });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    if (hashOtp(otp) !== user.deletionOtp) {
      await user.increment('deletionOtpAttempts');
      return res.status(400).json({
        success: false,
        message: 'Incorrect OTP. Please try again.',
      });
    }

    // OTP is correct — issue a short-lived verification token
    await user.update({
      deletionOtp: null,
      deletionOtpExpiresAt: null
    });

    return res.json({
      success: true,
      message: 'Your phone number has been verified.'
    });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════
// POST /api/account/delete/confirm
// body: { phoneNumber }
// Sets isActive = false, clears FCM token, signs out.
// ══════════════════════════════════════════════════════════════════

exports.confirmDeletion = async (req, res, next) => {
  try {
    const digits = normalizePhone(req.body?.phoneNumber);

    if (!digits) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your phone number first.',
      });
    }

    const last10 = digits.slice(-10);
    const user = await User.findOne({
      where: sequelize.where(
        sequelize.fn('RIGHT', sequelize.col('mobile'), 10),
        last10,
      ),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number.',
      });
    }

    if (
      !user.deletionVerificationExpiresAt ||
      new Date(user.deletionVerificationExpiresAt) < new Date()
    ) {
      await user.update({
        deletionVerificationExpiresAt: null,
      });
      return res.status(400).json({
        success: false,
        message: 'Verification expired. Please start again.',
      });
    }

    // ── Deactivate ───────────────────────────────────────────
    await user.update({
      isActive: false,
      fcmToken: null,
      deviceType: null
    });

    return res.json({
      success: true,
      message:
        'Your account has been deactivated. Contact support if you want to reactivate.',
    });
  } catch (err) {
    next(err);
  }
};