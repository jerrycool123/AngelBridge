export class CustomRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CustomBotError';
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends CustomRequestError {
  constructor(message = 'Bad Request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends CustomRequestError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends CustomRequestError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends CustomRequestError {
  constructor(message = 'Not Found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class InternalServerError extends CustomRequestError {
  constructor(message = 'Internal Server Error') {
    super(message, 500);
    this.name = 'InternalServerError';
  }
}
