const { pool } = require('../configs/sql.config');

async function listDevices(opts = {}) {
  const page = Math.max(parseInt(String(opts.page), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(opts.limit), 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];

  if (opts.status) {
    conditions.push('d.Status = ?');
    params.push(String(opts.status).toUpperCase());
  }
  if (opts.search && String(opts.search).trim()) {
    conditions.push('(d.DeviceID LIKE ? OR d.DeviceName LIKE ?)');
    const s = `%${String(opts.search).trim()}%`;
    params.push(s, s);
  }

  const where = conditions.join(' AND ');

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM Devices d WHERE ${where}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.query(
    `SELECT
      d.DeviceID,
      d.DeviceName,
      d.DeviceType,
      d.Status,
      d.FirmwareVer,
      d.LastPingAtUTC,
      d.Metadata,
      d.AssignedShipmentID,
      d.CreatedAtUTC,
      d.UpdatedAtUTC
    FROM Devices d
    WHERE ${where}
    ORDER BY d.UpdatedAtUTC DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total, page, limit };
}

async function findDeviceById(deviceId) {
  const [rows] = await pool.query(
    'SELECT * FROM Devices WHERE DeviceID = ? LIMIT 1',
    [deviceId]
  );
  return rows[0] || null;
}

async function insertDevice({ DeviceID, DeviceName, DeviceType, FirmwareVer }) {
  await pool.query(
    `INSERT INTO Devices (DeviceID, DeviceName, DeviceType, FirmwareVer)
     VALUES (?, ?, ?, ?)`,
    [DeviceID, DeviceName, DeviceType, FirmwareVer]
  );
}

async function updateDevice(deviceId, fields) {
  const setClauses = [];
  const params = [];

  if (fields.DeviceName !== undefined) {
    setClauses.push('DeviceName = ?');
    params.push(fields.DeviceName);
  }
  if (fields.DeviceType !== undefined) {
    setClauses.push('DeviceType = ?');
    params.push(fields.DeviceType);
  }
  if (fields.Status !== undefined) {
    setClauses.push('Status = ?');
    params.push(fields.Status);
  }
  if (fields.FirmwareVer !== undefined) {
    setClauses.push('FirmwareVer = ?');
    params.push(fields.FirmwareVer);
  }
  if (fields.Metadata !== undefined) {
    setClauses.push('Metadata = ?');
    params.push(fields.Metadata);
  }

  if (setClauses.length === 0) return { affectedRows: 0 };

  params.push(deviceId);
  const [result] = await pool.query(
    `UPDATE Devices SET ${setClauses.join(', ')} WHERE DeviceID = ?`,
    params
  );
  return result;
}

async function assignDeviceToShipment(deviceId, shipmentId) {
  await pool.query(
    `UPDATE Devices SET AssignedShipmentID = ? WHERE DeviceID = ?`,
    [shipmentId, deviceId]
  );

  if (shipmentId) {
    await pool.query(
      `UPDATE Shipments SET TrackingDeviceID = ? WHERE ShipmentID = ?`,
      [deviceId, shipmentId]
    );
  }
}

module.exports = {
  listDevices,
  findDeviceById,
  insertDevice,
  updateDevice,
  assignDeviceToShipment,
};
