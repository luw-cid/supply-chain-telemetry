class AppError extends Error {
	constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
		super(message);
		this.name = 'AppError';
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		Error.captureStackTrace?.(this, this.constructor);
	}

	static badRequest(message, details = null) {
		return new AppError(message, 400, 'BAD_REQUEST', details);
	}

	static unauthorized(message = 'Unauthorized', details = null) {
		return new AppError(message, 401, 'UNAUTHORIZED', details);
	}

	static forbidden(message = 'Forbidden', details = null) {
		return new AppError(message, 403, 'FORBIDDEN', details);
	}

	static notFound(message = 'Resource not found', details = null) {
		return new AppError(message, 404, 'NOT_FOUND', details);
	}

	static conflict(message, details = null) {
		return new AppError(message, 409, 'CONFLICT', details);
	}

	static internal(message = 'Internal server error', details = null) {
		return new AppError(message, 500, 'INTERNAL_ERROR', details);
	}
}

module.exports = AppError;
