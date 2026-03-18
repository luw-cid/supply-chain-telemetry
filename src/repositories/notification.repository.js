const { pool } = require('../configs/sql.config');

async function findPartyContactById(partyId) {
  const [rows] = await pool.query(
    'SELECT Name, Email FROM Parties WHERE PartyID = ? LIMIT 1',
    [partyId]
  );

  return rows[0] || null;
}

module.exports = {
  findPartyContactById,
};
