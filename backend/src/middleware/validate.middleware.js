import { body, validationResult } from 'express-validator';
import { ValidationError } from './error.middleware.js';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(', ');
    return next(new ValidationError(message));
  }
  next();
};

export const validateCreateSong = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title max 200 chars'),
  body('artist').trim().notEmpty().withMessage('Artist is required').isLength({ max: 200 }).withMessage('Artist max 200 chars'),
  body('duration').isFloat({ min: 0.1 }).withMessage('Duration must be a positive number'),
  body('albumId').optional({ nullable: true }).isMongoId().withMessage('Invalid albumId'),
  handleValidationErrors,
];

export const validateCreateAlbum = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title max 200 chars'),
  body('artist').trim().notEmpty().withMessage('Artist is required').isLength({ max: 200 }).withMessage('Artist max 200 chars'),
  body('releaseYear')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage(`Release year must be between 1900 and ${new Date().getFullYear() + 1}`),
  handleValidationErrors,
];
