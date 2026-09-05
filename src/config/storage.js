const { Storage } = require('@google-cloud/storage');
const path = require('path');

const bucketName = process.env.GCP_BUCKET_NAME;

if (!bucketName) {
  throw new Error('GCP_BUCKET_NAME is not configured');
}

// Path to your service account JSON
const keyFilename = path.resolve(
  __dirname,
  '../../service-account.json'
);

console.log('GCS configuration:', {
  bucketName,
  keyFilename,
});

// Create Google Cloud Storage client
const storage = new Storage({
  keyFilename,
  projectId: process.env.GCP_PROJECT_ID,
});

const bucket = storage.bucket(bucketName);

module.exports = {
  storage,
  bucket,
  bucketName,
};
