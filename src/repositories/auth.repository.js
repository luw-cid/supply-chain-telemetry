const { pool } = require('../configs/sql.config');

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status
     FROM Users
     WHERE Email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function createUser({
  userId,
  name,
  email,
  phone,
  passwordHash,
  role,
  partyId,
}) {
  await pool.query(
    `INSERT INTO Users (UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [userId, name, email, phone, passwordHash, role, partyId]
  );
}

module.exports = {
  findUserByEmail,
  createUser,
};
