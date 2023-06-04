import { RequestHandler } from 'express';
import { validationResult } from 'express-validator';

import { BadRequestError } from '../../utils/error.js';

const validateRequest: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new BadRequestError(
      errors
        .array()
        .map(({ msg }) => (typeof msg === 'string' ? msg : ''))
        .join('\n'),
    );
  }

  next();
};

export default validateRequest;
