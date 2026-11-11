const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Worker, BankDetail } = require('../models');
const { generateOTP, isOTPExpired } = require('../utils/helpers');
const { USER_ROLES } = require('../utils/constants');
const { sendSMS } = require('../utils/sms');

// ─── Helper: Generate JWT token ─────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '3y' }
  );
};

// ─── Register a new user (with optional worker role) ─────────────────
exports.register = async (req, res, next) => {
  try {
    const { mobile, name, email, password, role, profession, experience, description, profileImage } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ where: { mobile } });
    if (existing) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }
    const hashedPassword = '';
    if (password) {
      // Hash password
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create user
    const user = await User.create({
      mobile,
      name, email,
      password: hashedPassword,
      role: role || USER_ROLES.USER,
      isVerified: false,
      profileImage
    });

    // If registering as worker, create worker profile
    let worker = null;
    if (role === USER_ROLES.WORKER) {
      if (!profession) {
        return res.status(400).json({ error: 'Profession is required for worker registration' });
      }
      worker = await Worker.create({
        userId: user.id,
        profession,
        experience: experience || 0,
        description: description || '',
        isVerified: false,
        isAvailable: true,
        rating: 0,
        totalJobs: 0,
      });
    }

    // Generate token
    const token = generateToken(user);

    // Remove password from response
    const userData = {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
    };

    res.status(201).json({
      success: true,
      token,
      user: userData,
      worker: worker || undefined,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Login with mobile & password ────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { mobile, password } = req.body;

    const user = await User.findOne({ where: { mobile } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    // Get worker profile if exists
    let worker = null;
    if (user.role === USER_ROLES.WORKER) {
      worker = await Worker.findOne({ where: { userId: user.id } });
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
      worker: worker || undefined,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Send OTP for verification / login ───────────────────────────────

const TEST_MOBILE = '9999999999';
const TEST_OTP = '333333';

exports.sendOTP = async (req, res, next) => {
  try {
    const { mobile, role } = req.body;

    if (!mobile) {
      return res.status(400).json({
        error: 'Mobile number is required'
      });
    }

    // Check Google Play Console test credentials
    const isTestUser = String(mobile) === TEST_MOBILE;

    // Generate fixed OTP for test user, random OTP for others
    const otp = isTestUser ? TEST_OTP : generateOTP();

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Find or create user
    let user = await User.findOne({
      where: { mobile }
    });

    if (!user) {
      user = await User.create({
        mobile,
        name: 'User',
        password: await bcrypt.hash('temp', 10),
        role: role || USER_ROLES.USER,
        isVerified: false,
        otp,
        otpExpiry,
      });
    } else {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account is inactive. Please contact support.'
        });
      }
      await user.update({
        otp,
        otpExpiry
      });
    }

    // Skip SMS for Google Play Console test account
    if (!isTestUser) {
      try {
        const smsResponse = await sendSMS(user.mobile, otp);
        console.log('SMS Gateway Response:', smsResponse);
      } catch (smsError) {
        console.error(
          'SMS Error:',
          smsError.response?.data || smsError.message
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      userId: user.id,
    });

  } catch (error) {
    next(error);
  }
};


exports.sendWorkerOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        error: 'Mobile number is required'
      });
    }

    const isTestUser = String(mobile) === TEST_MOBILE;

    // Fixed OTP for test account
    const otp = isTestUser ? TEST_OTP : generateOTP();

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Find worker
    let user = await User.findOne({
      where: {
        mobile,
        role: 'worker'
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Service Partner not found please register'
      });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact support.'
      });
    }
    await user.update({
      otp,
      otpExpiry
    });

    // Skip SMS for test account
    if (!isTestUser) {
      try {
        const smsResponse = await sendSMS(user.mobile, otp);
        console.log('SMS Gateway Response:', smsResponse);
      } catch (smsError) {
        console.error(
          'SMS Error:',
          smsError.response?.data || smsError.message
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      userId: user.id,
    });

  } catch (error) {
    next(error);
  }
};

// ─── Verify OTP ──────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp, role } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ error: 'Mobile and OTP are required' });
    }

    const user = await User.findOne({ where: { mobile } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check OTP expiry
    if (isOTPExpired(user.otpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Update user details if provided (for registration flow)
    const updates = { isVerified: true, otp: null, otpExpiry: null };
    await user.update(updates);

    // If registering as worker, create worker profile
    let worker = null;
    if (role === USER_ROLES.WORKER) {
      worker = await Worker.findOne({ where: { userId: user.id } })
    }

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
      worker: worker || undefined,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Resend OTP ──────────────────────────────────────────────────────
exports.resendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const user = await User.findOne({ where: { mobile } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for rate limiting (optional: prevent spam)
    // Can track lastOTPSentAt in User model

    const newOtp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.update({ otp: newOtp, otpExpiry });

    if (process.env.NODE_ENV === 'development') {
      return res.status(200).json({
        success: true,
        message: 'OTP resent',
        otp: newOtp,
      });
    }

    res.status(200).json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    next(error);
  }
};


exports.inactiveUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User is already inactive'
      });
    }

    await user.update({
      isActive: false,
      fcmToken: null
    });

    return res.status(200).json({
      success: true,
      message: 'User account deactivated successfully'
    });

  } catch (error) {
    next(error);
  }
};

// ─── Register device token for push notifications ────────────────────
exports.registerDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken, deviceType } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token is required' });
    }
    await User.update(
      { fcmToken: deviceToken, deviceType: deviceType || 'mobile' },
      { where: { id: req.user.id } }
    );
    res.status(200).json({ success: true, message: 'Device token registered' });
  } catch (error) {
    next(error);
  }
};

// ─── Get current user profile ────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let worker = null;
    if (user.role === USER_ROLES.WORKER) {
      worker = await Worker.findOne({
        where: { userId: user.id },
        include: [{ model: BankDetail }],
      });
    }

    res.status(200).json({
      success: true,
      data: { user, worker },
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};