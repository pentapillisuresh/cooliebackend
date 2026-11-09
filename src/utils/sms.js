
const axios = require('axios');

const sendSMS = async (mobile, otp) => {
  const message =
    `Welcome to SHAHILLS ENTERPRISES! Your login OTP is ${otp}. ` +
    `It is valid for 5 minutes. Do not share this OTP with anyone. ` +
    `Visit https://shahillfacilityservices.com`;

  const response = await axios.get(
    'http://whatsapp.esotericprojects.com/api/sendmsg.php',
    {
      params: {
        user: process.env.SMS_USER,
        pass: process.env.SMS_PASSWORD,
        sender: process.env.SMS_SENDER || 'SAHENP',
        phone: mobile,
        text: message,
        priority: 'ndnd',
        stype: 'normal'
      },
      timeout: 15000
    }
  );

  return response.data;
};

module.exports = { sendSMS };
