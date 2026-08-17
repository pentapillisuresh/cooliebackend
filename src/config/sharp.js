const sharp = require('sharp');

/**
 * Default Sharp options for image processing
 */
const DEFAULT_OPTIONS = {
  // Resize settings
  width: 1200,
  height: 1200,
  fit: 'inside',          // Preserve aspect ratio, fit inside dimensions
  withoutEnlargement: true,

  // JPEG compression
  jpegQuality: 80,
  jpegProgressive: true,

  // PNG compression
  pngCompressionLevel: 9,
  pngAdaptiveFiltering: true,

  // WebP compression
  webpQuality: 75,

  // Output format preferences (fallback)
  outputFormat: 'jpeg',
};

/**
 * Process an image buffer with default optimization
 * @param {Buffer} buffer - Input image buffer
 * @param {Object} options - Override options (width, height, quality, etc.)
 * @returns {Promise<Buffer>} Processed image buffer
 */
const processImage = async (buffer, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let pipeline = sharp(buffer);

  // Resize if dimensions provided
  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, {
      fit: opts.fit,
      withoutEnlargement: opts.withoutEnlargement,
    });
  }

  // Determine output format from options or original metadata
  const metadata = await sharp(buffer).metadata();
  let outputFormat = opts.outputFormat || metadata.format || 'jpeg';

  // Apply format-specific compression
  switch (outputFormat) {
    case 'jpeg':
    case 'jpg':
      pipeline = pipeline.jpeg({
        quality: opts.jpegQuality,
        progressive: opts.jpegProgressive,
      });
      break;
    case 'png':
      pipeline = pipeline.png({
        compressionLevel: opts.pngCompressionLevel,
        adaptiveFiltering: opts.pngAdaptiveFiltering,
      });
      break;
    case 'webp':
      pipeline = pipeline.webp({
        quality: opts.webpQuality,
      });
      break;
    default:
      // Fallback to JPEG
      pipeline = pipeline.jpeg({ quality: opts.jpegQuality });
  }

  return pipeline.toBuffer();
};

/**
 * Get file extension for given image format
 */
const getExtension = (format) => {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return '.jpg';
    case 'png':
      return '.png';
    case 'webp':
      return '.webp';
    default:
      return '.jpg';
  }
};

/**
 * Prepare optimized filename with correct extension
 */
const getOptimizedFilename = (originalName, format) => {
  const base = originalName.replace(/\.[^.]+$/, '');
  const ext = getExtension(format);
  return `${base}-optimized${ext}`;
};

module.exports = {
  DEFAULT_OPTIONS,
  processImage,
  getExtension,
  getOptimizedFilename,
};