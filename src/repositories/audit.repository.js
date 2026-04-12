const { pool } = require('../configs/sql.config');

/**
 * @param {{ fromDate?: string, toDate?: string, tableName?: string, page?: number, limit?: number }} opts
 */
async function listAuditLogs(opts = {}) {
  const page = Math.max(parseInt(String(opts.page), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(opts.limit), 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];

  if (opts.fromDate) {
    conditions.push('a.ChangedAtUTC >= ?');
    params.push(opts.fromDate);
  }
  if (opts.toDate) {
    conditions.push('a.ChangedAtUTC <= ?');
    params.push(opts.toDate);
  }
  if (opts.tableName && String(opts.tableName).trim()) {
    conditions.push('a.TableName = ?');
    params.push(String(opts.tableName).trim());
  }

  const where = conditions.join(' AND ');

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM AuditLog a WHERE ${where}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.query(
    `SELECT
      a.AuditID,
      a.TableName,
      a.Operation,
      a.RecordID,
      a.OldValue,
      a.NewValue,
      a.ChangedBy,
      a.ChangedAtUTC,
      a.ClientIP,
      a.UserAgent
    FROM AuditLog a
    WHERE ${where}
    ORDER BY a.ChangedAtUTC DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total, page, limit };
}

/**
 * @param {{
 *   tableName: string,
 *   operation: 'INSERT'|'UPDATE'|'DELETE',
 *   recordId: string,
 *   oldValue: object | null,
 *   newValue: object | null,
 *   changedBy: string,
 *   clientIp?: string | null,
 *   userAgent?: string | null,
 * }} row
 */
async function insertAuditLog(row) {
  await pool.query(
    `INSERT INTO AuditLog (TableName, Operation, RecordID, OldValue, NewValue, ChangedBy, ClientIP, UserAgent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.tableName,
      row.operation,
      row.recordId,
      row.oldValue == null ? null : JSON.stringify(row.oldValue),
      row.newValue == null ? null : JSON.stringify(row.newValue),
      row.changedBy,
      row.clientIp ?? null,
      row.userAgent ?? null,
    ],
  );
}

module.exports = {
  listAuditLogs,
  insertAuditLog,
};
