const { pool } = require('../configs/sql.config');

/**
 * @param {{ status?: string, fromDate?: string, toDate?: string, page?: number, limit?: number }} opts
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

module.exports = {
  listAlarmEvents,
};
