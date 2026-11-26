
const AppError = require("../utils/app-error");

const notFound = (req, res, next) => {
  next(
    new AppError(
      `Route not found: ${req.originalUrl}`,
      404
    )
  );
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";
  let details = error.details || null;

  if (error.code === 11000) {
    statusCode = 409;
    message = "A record with this value already exists";
  }

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Database validation failed";
  }

  if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource identifier";
  }

  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    message = "Internal server error";
    details = null;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { errors: details }),
    ...(process.env.NODE_ENV !== "production" && {
      stack: error.stack,
    }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
