
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
