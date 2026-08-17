const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const path = require('path');

const ENABLE_FIREBASE =
  process.env.ENABLE_FIREBASE === 'true';

let firebaseApp = null;
let messaging = null;

if (!ENABLE_FIREBASE) {
  console.warn('⚠️ Firebase disabled (ENABLE_FIREBASE != true)');
  module.exports = { firebaseApp, messaging };
  return;
}

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, './coolie-firebase-service-account.json');
let serviceAccount = null;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  } else {
    console.warn('⚠️ Firebase credentials missing');
  }
}
try {
  if (serviceAccount?.private_key) {
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    messaging = getMessaging(firebaseApp);

    console.log('🔥 Firebase Admin initialized successfully');
  } else {
    console.warn('⚠️ Firebase skipped (invalid service account)');
  }
} catch (error) {
  console.error('⚠️ Firebase init failed (server continues):', error.message);
}

module.exports = {
  firebaseApp,
  messaging,
};