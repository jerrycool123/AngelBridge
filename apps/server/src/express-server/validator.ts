import { body, param } from 'express-validator';

import validateRequest from './middlewares/validate.js';

namespace RequestValidator {
  export const discordAuth = [
    body('token')
      .notEmpty()
      .withMessage("'token' is required")
      .bail()
      .isJWT()
      .withMessage("'token' must be a valid JWT"),
    validateRequest,
  ];
  export const googleAuth = [
    body('code').notEmpty().withMessage("'code' is required"),
    validateRequest,
  ];
  export const verifyMembership = [
    param('membershipRoleId').notEmpty().withMessage("'membershipRoleId' is required"),
    validateRequest,
  ];
}

export default RequestValidator;
