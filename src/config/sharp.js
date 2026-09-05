const sharp = require('sharp');

const DEFAULT_OPTIONS = {
  width: 1200,
  height: 1200,
  fit: 'inside',
  withoutEnlargement: true,

  jpegQuality: 80,
  jpegProgressive: true,

  pngCompressionLevel: 9,
  pngAdaptiveFiltering: true,

  webpQuality: 75,

  outputFormat: 'webp',
};

const processImage = async (buffer, options = {}) => {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let pipeline = sharp(buffer);

  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, {
      fit: opts.fit,
      withoutEnlargement: opts.withoutEnlargement,
    });
  }

  const outputFormat = opts.outputFormat;

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
      pipeline = pipeline.jpeg({
        quality: opts.jpegQuality,
      });
  }

  return pipeline.toBuffer();
};

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
