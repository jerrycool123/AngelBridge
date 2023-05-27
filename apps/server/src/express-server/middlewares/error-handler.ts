import { ErrorRequestHandler } from 'express';

import { CustomError } from '../../libs/error.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode: number, message: string;
  if (err instanceof CustomError) {
    console.error(`[${err.statusCode} ${err.name}]: ${err.message}`);
    statusCode = err.statusCode;
    message = err.message;
  } else {
    console.error(err);
    statusCode = 500;
    message = 'Internal Server Error';
  }

  return res.status(statusCode).send({ message });
};

export default errorHandler;
