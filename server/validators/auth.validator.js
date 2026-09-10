import { body, param, query } from 'express-validator';

export const registerValidator = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('dob').isDate().withMessage('Valid date of birth is required'),
  body('collegeName').trim().notEmpty().withMessage('College name is required'),
  body('university').trim().notEmpty().withMessage('University is required'),
  body('course').trim().notEmpty().withMessage('Course is required'),
  body('branch').trim().notEmpty().withMessage('Branch is required'),
  body('year').isIn(['1st', '2nd', '3rd', '4th', '5th']).withMessage('Valid year is required'),
  body('phone').matches(/^\+?[\d\s-]{10,15}$/).withMessage('Valid phone number is required'),
];

export const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
];

export const verifyOTPValidator = [
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
];

export const resetPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Passwords do not match');
    return true;
  }),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Passwords do not match');
    return true;
  }),
];
