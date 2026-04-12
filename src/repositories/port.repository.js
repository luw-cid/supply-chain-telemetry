const { pool } = require('../configs/sql.config');

async function listPorts({ includeAll = false } = {}) {
  const where = includeAll ? '1=1' : "Status = 'OPERATIONAL'";
  const [rows] = await pool.query(
    `SELECT PortCode, Name, Country, Latitude, Longitude, Timezone, Status
     FROM Ports WHERE ${where} ORDER BY Name`,
  );
  return rows;
}

/** All ports with coordinates (any status) — for dashboard map overlay */
async function listPortsWithCoordinates() {
  const [rows] = await pool.query(
    `SELECT PortCode, Name, Country, Latitude, Longitude, Timezone, Status
     FROM Ports
     WHERE Latitude IS NOT NULL AND Longitude IS NOT NULL
     ORDER BY Name`,
  );
  return rows;
}

async function findPortByCode(portCode) {
  const [rows] = await pool.query(
    `SELECT PortCode, Name, Country, Latitude, Longitude, Timezone, Status
     FROM Ports WHERE PortCode = ? LIMIT 1`,
    [portCode],
  );
  return rows[0] || null;
}

async function insertPort({ portCode, name, country, latitude, longitude, timezone, status }) {
  await pool.query(
    `INSERT INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [portCode, name, country, latitude ?? null, longitude ?? null, timezone ?? null, status],
  );
}

async function updatePortRow(portCode, { name, country, latitude, longitude, timezone, status }) {
  const [result] = await pool.query(
    `UPDATE Ports SET Name = ?, Country = ?, Latitude = ?, Longitude = ?, Timezone = ?, Status = ?
     WHERE PortCode = ?`,
    [name, country, latitude ?? null, longitude ?? null, timezone ?? null, status, portCode],
  );
  return result.affectedRows;
}

async function countPortReferences(portCode) {
  const [shipRows] = await pool.query(
    `SELECT COUNT(*) AS n FROM Shipments
     WHERE OriginPortCode = ? OR DestinationPortCode = ? OR CurrentPortCode = ?`,
    [portCode, portCode, portCode],
  );
  const [ownRows] = await pool.query(
    `SELECT COUNT(*) AS n FROM Ownership WHERE HandoverPortCode = ?`,
    [portCode],
  );
  return Number(shipRows[0]?.n || 0) + Number(ownRows[0]?.n || 0);
}

async function deletePortRow(portCode) {
  const [result] = await pool.query('DELETE FROM Ports WHERE PortCode = ?', [portCode]);
  return result.affectedRows;
}

module.exports = {
  listPorts,
  listPortsWithCoordinates,
  findPortByCode,
  insertPort,
  updatePortRow,
  countPortReferences,
  deletePortRow,
};
