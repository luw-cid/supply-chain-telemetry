const { ingestTelemetry } = require('../services/saga-orchestrator');
const telemetryService = require('../services/telemetry.service');

async function ingestTelemetryController(req, res, next) {
	try {
		const result = await ingestTelemetry(req.body);
		res.status(200).json({
			success: true,
			data: result,
		});
	} catch (error) {
		next(error);
	}
}

async function getTelemetryLogsController(req, res, next) {
	try {
		const { id } = req.params;
		const result = await telemetryService.getTelemetryLogs(id, req.query);
		res.status(200).json(result);
	} catch (error) {
		next(error);
	}
}

module.exports = {
	ingestTelemetryController,
	getTelemetryLogsController,
};

