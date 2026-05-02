const { pool } = require('../configs/sql.config');

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
    params.push(String(opts.alarmType).toUpperCase());
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
      ae.AssignedTo,
      ae.AssignedAtUTC,
      ae.ResolvedBy,
      ae.ResolvedAtUTC,
      ae.CreatedAtUTC,
      s.Status AS ShipmentStatus,
      TIMESTAMPDIFF(HOUR, ae.AlarmAtUTC, COALESCE(ae.ResolvedAtUTC, NOW())) AS AlarmAgeHours
    FROM AlarmEvents ae
    INNER JOIN Shipments s ON s.ShipmentID = ae.ShipmentID
    WHERE ${where}
    ORDER BY ae.AlarmAtUTC DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total, page, limit };
}

async function updateAlarmStatus(alarmEventId, fields) {
  const setClauses = [];
  const params = [];

  if (fields.status) {
    setClauses.push('Status = ?');
    params.push(fields.status);
  }
  if (fields.acknowledgedBy) {
    setClauses.push('AcknowledgedBy = ?');
    params.push(fields.acknowledgedBy);
  }
  if (fields.acknowledgedAt) {
    setClauses.push('AcknowledgedAtUTC = ?');
    params.push(fields.acknowledgedAt);
  }
  if (fields.assignedTo) {
    setClauses.push('AssignedTo = ?');
    params.push(fields.assignedTo);
  }
  if (fields.assignedAt) {
    setClauses.push('AssignedAtUTC = ?');
    params.push(fields.assignedAt);
  }

  if (setClauses.length === 0) return { affectedRows: 0 };

  params.push(alarmEventId);
  const [result] = await pool.query(
    `UPDATE AlarmEvents SET ${setClauses.join(', ')} WHERE AlarmEventID = ?`,
    params
  );
  return result;
}

async function resolveAlarm(alarmEventId, fields) {
  const [result] = await pool.query(
    `UPDATE AlarmEvents
     SET Status = ?,
         ResolvedBy = ?,
         ResolvedAtUTC = ?,
         AlarmReason = CONCAT(AlarmReason, ' | Resolved: ', ?)
     WHERE AlarmEventID = ?`,
    [fields.status, fields.resolvedBy, fields.resolvedAt, fields.resolution, alarmEventId]
  );

  if (result.affectedRows > 0) {
    const [alarmRows] = await pool.query(
      'SELECT ShipmentID FROM AlarmEvents WHERE AlarmEventID = ?',
      [alarmEventId]
    );
    if (alarmRows[0]) {
      await pool.query(
        `UPDATE Shipments
         SET Status = 'NORMAL',
             LastTelemetryStatus = 'OK',
             AlarmAtUTC = NULL,
             AlarmReason = NULL
         WHERE ShipmentID = ?`,
        [alarmRows[0].ShipmentID]
      );
    }
  }

  return result;
}

async function getAlarmStats() {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS TotalOpen,
       SUM(CASE WHEN Status = 'OPEN' THEN 1 ELSE 0 END) AS OpenCount,
       SUM(CASE WHEN Status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) AS AcknowledgedCount,
       SUM(CASE WHEN Severity = 'CRITICAL' AND Status IN ('OPEN','ACKNOWLEDGED') THEN 1 ELSE 0 END) AS CriticalOpen,
       SUM(CASE WHEN Severity = 'HIGH' AND Status IN ('OPEN','ACKNOWLEDGED') THEN 1 ELSE 0 END) AS HighOpen,
       ROUND(AVG(CASE WHEN Status IN ('OPEN','ACKNOWLEDGED') THEN TIMESTAMPDIFF(HOUR, AlarmAtUTC, NOW()) END), 1) AS AvgAgeHours,
       MAX(CASE WHEN Status IN ('OPEN','ACKNOWLEDGED') THEN TIMESTAMPDIFF(HOUR, AlarmAtUTC, NOW()) END) AS MaxAgeHours
     FROM AlarmEvents`
  );
  return rows[0] || {};
}

module.exports = {
  listAlarmEvents,
  updateAlarmStatus,
  resolveAlarm,
  getAlarmStats,
};
