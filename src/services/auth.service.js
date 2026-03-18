const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const authRepository = require('../repositories/auth.repository');

function badRequest(message) {
	const error = new Error(message);
	error.statusCode = 400;
	return error;
}

function unauthorized(message) {
	const error = new Error(message);
	error.statusCode = 401;
	return error;
}

async function register({ name, email, phone, password, role = 'OWNER', partyId = null }) {
	if (!name || !email || !phone || !password) {
		throw badRequest('Name, email, phone and password are required');
	}

	if (typeof password !== 'string' || password.length < 8) {
		throw badRequest('Password must be at least 8 characters');
	}

	const normalizedEmail = String(email).trim().toLowerCase();

	const existingUser = await authRepository.findUserByEmail(normalizedEmail);
	if (existingUser) {
		throw badRequest('Email already exists');
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const userId = randomUUID();

	const normalizedName = String(name).trim();
	const normalizedPhone = String(phone).trim();
	if (!normalizedPhone) {
		throw badRequest('Phone is required');
	}

	await authRepository.createUser({
		userId,
		name: normalizedName,
		email: normalizedEmail,
		phone: normalizedPhone,
		passwordHash,
		role,
		partyId,
	});

	return {
		userId,
		name: normalizedName,
		email: normalizedEmail,
		phone: normalizedPhone,
		role,
		partyId,
	};
}

async function login({ email, password }) {
	if (!email || !password) {
		throw badRequest('Email and password are required');
	}

	const normalizedEmail = String(email).trim().toLowerCase();

	const user = await authRepository.findUserByEmail(normalizedEmail);
	if (!user) {
		throw unauthorized('Invalid credentials');
	}
	if (user.Status !== 'ACTIVE') {
		throw unauthorized('User is not active');
	}

	const isValid = await bcrypt.compare(password, user.PasswordHash);
	if (!isValid) {
		throw unauthorized('Invalid credentials');
	}

	if (!process.env.JWT_SECRET) {
		throw new Error('Missing JWT_SECRET in environment');
	}

	const accessToken = jwt.sign(
		{
			sub: user.UserID,
			role: user.Role,
			partyId: user.PartyID,
		},
		process.env.JWT_SECRET,
		{
			expiresIn: process.env.JWT_EXPIRES_IN || '1d',
		}
	);

	return {
		accessToken,
		user: {
			userId: user.UserID,
			name: user.Name,
			email: user.Email,
			phone: user.Phone,
			role: user.Role,
			partyId: user.PartyID,
		},
	};
}

module.exports = {
	register,
	login,
};