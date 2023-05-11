export class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Discord Bot Error
export class CustomBotError extends CustomError {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// HTTP Request Error
export abstract class CustomRequestError extends CustomError {
  abstract statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends CustomRequestError {
  statusCode = 400;

  constructor(message = 'Bad Request') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends CustomRequestError {
  statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ForbiddenError extends CustomRequestError {
  statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends CustomRequestError {
  statusCode = 404;

  constructor(message = 'Not Found') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InternalServerError extends CustomRequestError {
  statusCode = 500;

  constructor(message = 'Internal Server Error') {
    super(message);
    this.name = this.constructor.name;
  }
}
