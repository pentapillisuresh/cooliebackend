
const axios = require('axios');

const sendSMS = async (mobile, otp) => {
  try {
    const message =
      `Welcome to SHAHILLS ENTERPRISES! Your login OTP is ${otp}. ` +
      `It is valid for 5 minutes. Do not share this OTP with anyone. ` +
      `Visit https : https://shahillfacilityservices.com`;

    const params = {
      user: process.env.SMS_USER,
      pass: process.env.SMS_PASSWORD,
      sender: process.env.SMS_SENDER || 'SAHENP',
      phone: String(mobile).replace(/\D/g, ''),
      text: message,
      priority: 'ndnd',
      stype: 'normal'
    };

    console.log('SMS request details:', {
      phone: params.phone,
      sender: params.sender,
      messageLength: message.length,
      userConfigured: !!params.user,
      passwordConfigured: !!params.pass
    });

    const response = await axios.get(
      'http://whatsapp.esotericprojects.com/api/sendmsg.php',
      {
        params,
        timeout: 15000
      }
    );

    console.log('SMS API response:', response.data);

    return response.data;

  } catch (error) {
    console.error('SMS sending failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    throw error;
  }
};

module.exports = { sendSMS };
