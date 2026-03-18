const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
	const authHeader = req.headers.authorization || '';
	const [scheme, token] = authHeader.split(' ');

	if (scheme !== 'Bearer' || !token) {
		return res.status(401).json({
			success: false,
			error: 'Missing bearer token',
		});
	}

	try {
		if (!process.env.JWT_SECRET) {
			throw new Error('Missing JWT_SECRET in environment');
		}

		req.user = jwt.verify(token, process.env.JWT_SECRET);
		return next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			error: 'Invalid or expired token',
		});
	}
}

function authorizeRoles(...roles) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				error: 'Unauthorized',
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				error: 'Forbidden',
			});
		}

		return next();
	};
}

module.exports = {
	authenticate,
	authorizeRoles,
};