const jwt = require('jsonwebtoken');
const AppError = require('../utils/app-error');

function authenticate(req, res, next) {
	const authHeader = req.headers.authorization || '';
	const [scheme, token] = authHeader.split(' ');

	if (scheme !== 'Bearer' || !token) {
		return next(AppError.unauthorized('Missing bearer token'));
	}

	try {
		if (!process.env.JWT_SECRET) {
			throw AppError.internal('Missing JWT_SECRET in environment');
		}

		req.user = jwt.verify(token, process.env.JWT_SECRET);
		return next();
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}
		return next(AppError.unauthorized('Invalid or expired token'));
	}
}

function authorizeRoles(...roles) {
	return (req, res, next) => {
		if (!req.user) {
			return next(AppError.unauthorized('Unauthorized'));
		}

		if (!roles.includes(req.user.role)) {
			return next(AppError.forbidden('Forbidden'));
		}

		return next();
	};
}

module.exports = {
	authenticate,
	authorizeRoles,
};