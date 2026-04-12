const { pool } = require('../configs/sql.config');

async function listPartiesForSelect() {
  const [rows] = await pool.query(
    `SELECT PartyID, Name, PartyType FROM Parties WHERE Status = 'ACTIVE' ORDER BY Name`,
  );
  return rows;
}

async function listPartiesDetailed() {
  const [rows] = await pool.query(
    `SELECT PartyID, PartyType, Name, Email, Phone, Address, Status, CreatedAtUTC, UpdatedAtUTC
     FROM Parties ORDER BY Name`,
  );
  return rows;
}

async function findPartyById(partyId) {
  const [rows] = await pool.query(
    `SELECT PartyID, PartyType, Name, Email, Phone, Address, Status, CreatedAtUTC, UpdatedAtUTC
     FROM Parties WHERE PartyID = ? LIMIT 1`,
    [partyId],
  );
  return rows[0] || null;
}

async function insertParty({ partyId, partyType, name, email, phone, address, status }) {
  await pool.query(
    `INSERT INTO Parties (PartyID, PartyType, Name, Email, Phone, Address, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [partyId, partyType, name, email ?? null, phone ?? null, address ?? null, status],
  );
}

async function updatePartyRow(partyId, { partyType, name, email, phone, address, status }) {
  const [result] = await pool.query(
    `UPDATE Parties SET PartyType = ?, Name = ?, Email = ?, Phone = ?, Address = ?, Status = ?
     WHERE PartyID = ?`,
    [partyType, name, email ?? null, phone ?? null, address ?? null, status, partyId],
  );
  return result.affectedRows;
}

module.exports = {
  listPartiesForSelect,
  listPartiesDetailed,
  findPartyById,
  insertParty,
  updatePartyRow,
};
