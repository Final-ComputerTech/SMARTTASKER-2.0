/**
 * Global Error Handler Middleware
 * Catches and formats all errors in a consistent way
 */

// Custom Error Class
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler Middleware
 * Must be placed LAST in middleware chain
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  // Validation Error
  if (err.name === 'SequelizeValidationError') {
    const message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation Error',
      details: message,
      errors: err.errors
    });
  }

  // Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'field';
    const value = err.errors?.[0]?.value || 'value';
    return res.status(409).json({
      success: false,
      statusCode: 409,
      message: `${field} "${value}" already exists`,
      field: field,
      value: value
    });
  }

  // Database Connection Error
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: 'Database connection error',
      details: 'Unable to connect to the database'
    });
  }

  // JWT Authentication Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Invalid token',
      details: 'The provided token is invalid or malformed'
    });
  }

  // JWT Expired Error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Token expired',
      details: 'Your session has expired. Please login again'
    });
  }

  // Cast Error (Invalid ID format)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Invalid ID format',
      details: `Invalid value for field: ${err.path}`
    });
  }

  // Not Found Error (404)
  if (err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: err.message || 'Resource not found',
      path: req.path
    });
  }

  // Unauthorized Error (401)
  if (err.statusCode === 401) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: err.message || 'Unauthorized access',
      details: 'Authentication required'
    });
  }

  // Forbidden Error (403)
  if (err.statusCode === 403) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      message: err.message || 'Forbidden',
      details: 'You do not have permission to access this resource'
    });
  }

  // Generic Error Response
  res.status(err.statusCode).json({
    success: false,
    statusCode: err.statusCode,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not Found Handler
 * Should be placed after all routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Cannot ${req.method} ${req.path}`, 404);
  next(error);
};

module.exports = {
  errorHandler,
  AppError,
  asyncHandler,
  notFoundHandler
};
