const { ingestTelemetry } = require('../services/saga-orchestrator');

async function ingestTelemetryController(req, res) {
  const result = await ingestTelemetry(req.body);
  res.status(200).json({
    success: true,
    data: result,
  });
}

module.exports = { ingestTelemetryController };

