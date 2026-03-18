const { ingestTelemetry } = require('../services/saga-orchestrator');

async function ingestTelemetryController(req, res) {
  try {
    const result = await ingestTelemetry(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    // Log chi tiết trên server, trả message gọn cho client
    console.error('[Telemetry] Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
}

module.exports = { ingestTelemetryController };

