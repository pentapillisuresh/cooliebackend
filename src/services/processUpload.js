const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { processImage } = require('../config/sharp');
const { bucket } = require('../config/storage');

// ─────────────────────────────────────────────
// Generate unique filename
// ─────────────────────────────────────────────

const generateFilename = (originalName, extension = null) => {
  const originalExt = path.extname(originalName);

  const ext = extension || originalExt || '';

  return `${uuidv4()}-${Date.now()}${ext}`;
};

// ─────────────────────────────────────────────
// Upload Buffer → Google Cloud Storage
// ─────────────────────────────────────────────

const uploadBufferToBucket = async ({
  buffer,
  filename,
  folder,
  contentType,
}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Upload data must be a Buffer');
  }

  if (buffer.length === 0) {
    throw new Error('Upload buffer is empty');
  }

  const filePath = `${folder}/${filename}`;

  console.log('Uploading to GCS:', {
    bucket: bucket.name,
    filePath,
    contentType,
    size: buffer.length,
  });

  const file = bucket.file(filePath);

  await file.save(buffer, {
    resumable: false,

    // Disable client-side checksum stream validation.
    validation: false,

    metadata: {
      contentType,
      cacheControl: 'public,max-age=31536000',
    },

    // Don't overwrite an existing object.
    preconditionOpts: {
      ifGenerationMatch: 0,
    },
  });

  console.log('GCS upload successful:', filePath);

  return {
    filename,
    path: filePath,
    fullUrl:
      `https://storage.googleapis.com/` +
      `${bucket.name}/${filePath}`,
  };
};

// ─────────────────────────────────────────────
// Process Image
// ─────────────────────────────────────────────

const processSingleImage = async (file) => {
  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Image buffer is missing');
  }

  console.log('Processing image:', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.buffer.length,
  });

  const processedBuffer = await processImage(file.buffer, {
    width: 1200,
    height: 1200,
    fit: 'inside',
    withoutEnlargement: true,

    // Convert images to WebP
    outputFormat: 'webp',
    webpQuality: 75,
  });

  console.log('Image processed:', {
    originalSize: file.buffer.length,
    processedSize: processedBuffer.length,
  });

  const filename = generateFilename(
    file.originalname,
    '.webp'
  );

  const uploaded = await uploadBufferToBucket({
    buffer: processedBuffer,
    filename,
    folder: 'images',
    contentType: 'image/webp',
  });

  return {
    ...uploaded,
    originalName: file.originalname,
    mimeType: 'image/webp',
    size: processedBuffer.length,
  };
};

// ─────────────────────────────────────────────
// Process PDF
// ─────────────────────────────────────────────

const processSingleDocument = async (file) => {
  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Document buffer is missing');
  }

  console.log('Processing document:', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.buffer.length,
  });

  const filename = generateFilename(
    file.originalname,
    '.pdf'
  );

  const uploaded = await uploadBufferToBucket({
    buffer: file.buffer,
    filename,
    folder: 'documents',
    contentType: 'application/pdf',
  });

  return {
    ...uploaded,
    originalName: file.originalname,
    mimeType: 'application/pdf',
    size: file.buffer.length,
  };
};

// ─────────────────────────────────────────────
// Process Single File
// ─────────────────────────────────────────────

const processSingleFile = async (file) => {
  if (!file) {
    throw new Error('No file provided');
  }

  if (!file.buffer) {
    throw new Error('File buffer is missing');
  }

  if (file.mimetype.startsWith('image/')) {
    return processSingleImage(file);
  }

  if (file.mimetype === 'application/pdf') {
    return processSingleDocument(file);
  }

  throw new Error(
    `Unsupported file type: ${file.mimetype}`
  );
};

// ─────────────────────────────────────────────
// Process Multiple Files
// ─────────────────────────────────────────────

const processMultipleFiles = async (files) => {
  if (!files || files.length === 0) {
    throw new Error('No files provided');
  }

  const results = [];

  for (const file of files) {
    const result = await processSingleFile(file);
    results.push(result);
  }

  return results;
};

// ─────────────────────────────────────────────
// Delete File
// ─────────────────────────────────────────────

const deleteFile = async (filePath) => {
  if (!filePath) {
    throw new Error('File path is required');
  }

  if (
    filePath.includes('..') ||
    filePath.startsWith('/') ||
    filePath.includes('\\')
  ) {
    throw new Error('Invalid file path');
  }

  const file = bucket.file(filePath);

  const [exists] = await file.exists();

  if (!exists) {
    return false;
  }

  await file.delete();

  return true;
};

module.exports = {
  processSingleFile,
  processSingleImage,
  processSingleDocument,
  processMultipleFiles,
  uploadBufferToBucket,
  deleteFile,
};