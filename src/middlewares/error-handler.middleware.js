const AppError = require('../utils/app-error');

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  const error = err instanceof AppError
    ? err
    : AppError.internal(err?.message || 'Internal server error');

  if (error.statusCode >= 500) {
    console.error('[ErrorHandler]', {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      code: error.code,
    });
  }

  const response = {
    success: false,
    error: error.message,
    code: error.code,
  };

  if (error.details) {
    response.details = error.details;
  }

  res.status(error.statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
