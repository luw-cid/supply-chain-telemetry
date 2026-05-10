const { pool } = require('../configs/sql.config');

/**
 * @param {{ status?: string, severity?: string, alarmType?: string, fromDate?: string, toDate?: string, page?: number, limit?: number }} opts
 */
async function listAlarmEvents(opts = {}) {
  const page = Math.max(parseInt(String(opts.page), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(opts.limit), 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];

  if (opts.status) {
    conditions.push('ae.Status = ?');
    params.push(String(opts.status).toUpperCase());
  }
  if (opts.severity) {
    conditions.push('ae.Severity = ?');
    params.push(String(opts.severity).toUpperCase());
  }
  if (opts.alarmType) {
    conditions.push('ae.AlarmType = ?');
    params.push(String(opts.alarmType));
  }
  if (opts.fromDate) {
    conditions.push('ae.AlarmAtUTC >= ?');
    params.push(opts.fromDate);
  }
  if (opts.toDate) {
    conditions.push('ae.AlarmAtUTC <= ?');
    params.push(opts.toDate);
  }

  const where = conditions.join(' AND ');

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM AlarmEvents ae WHERE ${where}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.query(
    `SELECT
      ae.AlarmEventID,
      ae.ShipmentID,
      ae.AlarmType,
      ae.Severity,
      ae.Status,
      ae.AlarmReason,
      ae.AlarmAtUTC,
      ae.Source,
      ae.AcknowledgedBy,
      ae.AcknowledgedAtUTC,
      ae.ResolvedBy,
      ae.ResolvedAtUTC,
      ae.CreatedAtUTC,
      s.Status AS ShipmentStatus
    FROM AlarmEvents ae
    INNER JOIN Shipments s ON s.ShipmentID = ae.ShipmentID
    WHERE ${where}
    ORDER BY ae.AlarmAtUTC DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total, page, limit };
}

async function updateAlarmEvent({ alarmId, status, userId, resolutionNote }) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // ResolutionNote column does not exist in schema – store note in AlarmReason on resolve
  const setClause = status === 'ACKNOWLEDGED'
    ? `Status = ?, AcknowledgedBy = ?, AcknowledgedAtUTC = ?`
    : `Status = ?, ResolvedBy = ?, ResolvedAtUTC = ?`;
  const params = status === 'ACKNOWLEDGED'
    ? [status, userId, now, alarmId]
    : [status, userId, now, alarmId];
  const [result] = await pool.query(
    `UPDATE AlarmEvents SET ${setClause} WHERE AlarmEventID = ? AND Status IN ('OPEN', 'ACKNOWLEDGED')`,
    params
  );
  if (result.affectedRows === 0) {
    const exists = await pool.query('SELECT Status FROM AlarmEvents WHERE AlarmEventID = ?', [alarmId]);
    if (exists[0].length === 0) throw require('../utils/app-error').notFound('Alarm not found');
    throw require('../utils/app-error').badRequest('Alarm is not in OPEN or ACKNOWLEDGED status');
  }

  if (status !== 'ACKNOWLEDGED') {
    const [shipmentRow] = await pool.query('SELECT ShipmentID FROM AlarmEvents WHERE AlarmEventID = ?', [alarmId]);
    const shipmentId = shipmentRow[0]?.ShipmentID;
    if (shipmentId) {
      const [openRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM AlarmEvents WHERE ShipmentID = ? AND Status IN ('OPEN', 'ACKNOWLEDGED')`,
        [shipmentId]
      );
      if (openRows[0].cnt === 0) {
        await pool.query(
          `UPDATE Shipments SET Status = 'NORMAL', LastTelemetryStatus = 'OK', AlarmAtUTC = NULL, AlarmReason = NULL, UpdatedAtUTC = CURRENT_TIMESTAMP(6) WHERE ShipmentID = ?`,
          [shipmentId]
        );
      }
    }
  }

  return { alarmId, status, userId, updatedAt: now };
}

async function createAlarmEvent({ shipmentId, alarmType, severity, alarmReason, source }) {
  const [result] = await pool.query(
    `INSERT INTO AlarmEvents (AlarmEventID, ShipmentID, AlarmType, Severity, Status, AlarmReason, AlarmAtUTC, Source)
     VALUES (UUID(), ?, ?, ?, 'OPEN', ?, CURRENT_TIMESTAMP(6), ?)`,
    [shipmentId, alarmType, severity, alarmReason, source]
  );
  await pool.query(
    `UPDATE Shipments SET Status = 'ALARM', AlarmAtUTC = CURRENT_TIMESTAMP(6), AlarmReason = ?, UpdatedAtUTC = CURRENT_TIMESTAMP(6) WHERE ShipmentID = ?`,
    [alarmReason, shipmentId]
  );
  return { success: true };
}

module.exports = {
  listAlarmEvents,
  updateAlarmEvent,
  createAlarmEvent,
};
