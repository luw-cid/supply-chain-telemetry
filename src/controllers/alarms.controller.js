const { listAlarms } = require('../services/alarms.service');

async function listAlarmsController(req, res, next) {
  try {
    const result = await listAlarms(req.query);
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
  listAlarmsController,
};
