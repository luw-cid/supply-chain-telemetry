const { ingestTelemetry } = require('../services/saga-orchestrator');
const telemetryService = require('../services/telemetry.service');
const { traceRoute } = require('../services/trace_route.service');
const { getOptimalRoutes } = require('../services/route_optimization.service');

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

async function traceRouteController(req, res, next) {
	try {
		const { shipmentId } = req.params;
		const maxPoints = req.query.maxPoints ? parseInt(req.query.maxPoints, 10) : undefined;

		const result = await traceRoute(shipmentId, {
			...(Number.isInteger(maxPoints) && maxPoints > 0 ? { maxPoints } : {})
		});

		res.status(200).json({
			success: true,
			data: result,
		});
	} catch (error) {
		next(error);
	}
}

async function routeOptimizationController(req, res, next) {
	try {
		const { origin, destination, routeType } = req.query;

		if (!origin || !destination) {
			return res.status(400).json({
				success: false,
				error: 'INVALID_INPUT',
				message: 'Origin and destination ports are required'
			});
		}

		const maxTransitStops = req.query.maxTransitStops
			? parseInt(req.query.maxTransitStops, 10)
			: undefined;
		const maxRoutes = req.query.maxRoutes ? parseInt(req.query.maxRoutes, 10) : undefined;
		const maxAlarmRate = req.query.maxAlarmRate
			? parseFloat(req.query.maxAlarmRate)
			: undefined;

		if (Number.isFinite(maxAlarmRate) && (maxAlarmRate < 0 || maxAlarmRate > 1)) {
			return res.status(400).json({
				success: false,
				error: 'INVALID_INPUT',
				message: 'maxAlarmRate must be between 0 and 1'
			});
		}

		const result = await getOptimalRoutes(origin, destination, {
			...(Number.isInteger(maxTransitStops) && maxTransitStops >= 0 ? { maxTransitStops } : {}),
			...(Number.isFinite(maxAlarmRate) ? { maxAlarmRate } : {}),
			...(Number.isInteger(maxRoutes) && maxRoutes > 0 ? { maxRoutes } : {}),
			...(routeType ? { routeType } : {}),
		});

		if (!result.success) {
			let statusCode = 400;
			if (result.error === 'PORT_NOT_FOUND') {
				statusCode = 404;
			}
			if (typeof result.message === 'string' && result.message.toLowerCase().includes('no routes found')) {
				statusCode = 404;
			}

			return res.status(statusCode).json(result);
		}

		res.status(200).json(result);
	} catch (error) {
		next(error);
	}
}

module.exports = {
	ingestTelemetryController,
	getTelemetryLogsController,
	traceRouteController,
	routeOptimizationController,
};

