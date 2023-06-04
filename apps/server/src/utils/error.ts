export abstract class CustomError extends Error {
  abstract statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends CustomError {
  statusCode = 400;

  constructor(message = 'Bad Request') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends CustomError {
  statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ForbiddenError extends CustomError {
  statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends CustomError {
  statusCode = 404;

  constructor(message = 'Not Found') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MethodNotAllowedError extends CustomError {
  statusCode = 405;

  constructor(message = 'Method Not Allowed') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class RequestTimeoutError extends CustomError {
  statusCode = 408;

  constructor(message = 'Request Timeout') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConflictError extends CustomError {
  statusCode = 409;

  constructor(message = 'Conflict') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InternalServerError extends CustomError {
  statusCode = 500;

  constructor(message = 'Internal Server Error') {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotImplementedError extends CustomError {
  statusCode = 501;

  constructor(message = 'Not Implemented') {
    super(message);
    this.name = this.constructor.name;
  }
}
