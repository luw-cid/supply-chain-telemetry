const auditRepository = require('../repositories/audit.repository');

async function listAuditLogs(query = {}) {
  return auditRepository.listAuditLogs({
    fromDate: query.fromDate,
    toDate: query.toDate,
    tableName: query.tableName,
    page: query.page,
    limit: query.limit,
  });
}

module.exports = {
  listAuditLogs,
};
