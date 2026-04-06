import cloudinary from '../lib/cloudinary.js';
import {
  ValidationError,
  UnauthorizedError,
  AppError,
} from '../middleware/error.middleware.js';
import { logger } from '../lib/logger.js';

export const uploadToCloudinary = async (file, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: 'auto',
      ...options,
    });
    return result.secure_url;
  } catch (error) {
    logger.error({ err: error }, 'Error in uploadToCloudinary');

    // Manejar errores específicos de Cloudinary
    if (error.http_code) {
      switch (error.http_code) {
        case 400:
          throw new ValidationError('Invalid file format or corrupted file');
        case 401:
          throw new UnauthorizedError('Cloudinary authentication failed');
        case 413:
          throw new ValidationError('File too large for upload');
        default:
          throw new AppError(
            `Upload failed: ${error.message}`,
            error.http_code
          );
      }
    }

    // Error genérico de red o sistema
    throw new AppError('Failed to upload file to cloud storage', 500);
  }
};

