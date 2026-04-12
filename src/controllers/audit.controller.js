const { listAuditLogs } = require('../services/audit.service');

async function listAuditLogsController(req, res, next) {
  try {
    const result = await listAuditLogs(req.query);
    return res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listAuditLogsController,
};
