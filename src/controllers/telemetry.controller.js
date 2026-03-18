const { ingestTelemetry } = require('../services/saga-orchestrator');

async function ingestTelemetryController(req, res, next) {
  try {
    const result = await ingestTelemetry(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { ingestTelemetryController };

