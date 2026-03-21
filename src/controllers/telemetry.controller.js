const { ingestTelemetry } = require('../services/saga-orchestrator');
const { traceRoute } = require('../services/trace_route.service');
const { getOptimalRoutes } = require('../services/route_optimization.service');

/**
 * ============================================================================
 * CONTROLLER: Ingest Telemetry
 * ============================================================================
 * POST /api/telemetry
 * Purpose: Nhận dữ liệu telemetry từ IoT devices
 */
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

/**
 * ============================================================================
 * CONTROLLER: Trace Route
 * ============================================================================
 * GET /api/v1/analytics/trace-route/:shipmentId
 * Purpose: Truy vết hành trình thực tế của shipment
 * 
 * PARAMETERS:
 * - shipmentId (path): ID của shipment cần trace
 * - maxPoints (query, optional): Số điểm tối đa trả về (default: 1000)
 * 
 * RESPONSE FORMAT:
 * {
 *   success: true,
 *   data: {
 *     type: "FeatureCollection",
 *     metadata: { ... },
 *     features: [ ... ]
 *   }
 * }
 * 
 * ERROR RESPONSES:
 * - 400: Invalid shipmentId
 * - 404: Shipment not found or no telemetry data
 * - 500: Server error
 */
async function traceRouteController(req, res, next) {
  try {
    const { shipmentId } = req.params;
    
    // Validate shipmentId
    if (!shipmentId || shipmentId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'shipmentId is required'
      });
    }

    // Parse optional query parameters
    const maxPoints = req.query.maxPoints 
      ? parseInt(req.query.maxPoints, 10) 
      : 1000;

    // Validate maxPoints
    if (isNaN(maxPoints) || maxPoints < 1 || maxPoints > 10000) {
      return res.status(400).json({
        success: false,
        error: 'maxPoints must be between 1 and 10000'
      });
    }

    console.log(`[TraceRouteController] Request for shipment: ${shipmentId}`);
    console.log(`[TraceRouteController] Max points: ${maxPoints}`);

    // Execute service
    const result = await traceRoute(shipmentId, { maxPoints });

    // Return GeoJSON FeatureCollection
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    return next(err);
  }
}

/**
 * ============================================================================
 * CONTROLLER: Route Optimization
 * ============================================================================
 * GET /api/v1/analytics/route-optimization
 * Purpose: Tìm lộ trình tối ưu giữa 2 cảng dựa trên dữ liệu lịch sử
 * 
 * QUERY PARAMETERS:
 * - origin (required): Mã cảng xuất phát (e.g., "VNSGN")
 * - destination (required): Mã cảng đích (e.g., "USNYC")
 * - maxTransitStops (optional): Số trạm dừng tối đa (default: 3)
 * - maxAlarmRate (optional): Tỷ lệ alarm tối đa chấp nhận (default: 0.1 = 10%)
 * - maxRoutes (optional): Số lộ trình tối đa trả về (default: 5)
 * - routeType (optional): Loại vận chuyển (SEA, AIR, LAND, MULTIMODAL)
 * 
 * RESPONSE FORMAT:
 * {
 *   success: true,
 *   routes: [
 *     {
 *       rank: 1,
 *       path: ["VNSGN", "SGSIN", "HKHKG", "USNYC"],
 *       legs: [...],
 *       summary: {
 *         total_stops: 2,
 *         total_hours: 480,
 *         total_distance_km: 16600,
 *         avg_alarm_rate: 0.06,
 *         max_alarm_rate: 0.08,
 *         route_types: ["SEA"],
 *         optimization_score: 0.45
 *       },
 *       recommendation: "RECOMMENDED"
 *     }
 *   ],
 *   metadata: { ... },
 *   insights: [ ... ]
 * }
 * 
 * ERROR RESPONSES:
 * - 400: Missing or invalid parameters
 * - 404: No routes found
 * - 500: Server error
 */
async function routeOptimizationController(req, res, next) {
  try {
    const { origin, destination, maxTransitStops, maxAlarmRate, maxRoutes, routeType } = req.query;

    // Validate required parameters
    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'Both origin and destination ports are required'
      });
    }

    // Parse and validate optional parameters
    const options = {};

    if (maxTransitStops) {
      const stops = parseInt(maxTransitStops, 10);
      if (isNaN(stops) || stops < 0 || stops > 5) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PARAMETER',
          message: 'maxTransitStops must be between 0 and 5'
        });
      }
      options.maxTransitStops = stops;
    }

    if (maxAlarmRate) {
      const alarmRate = parseFloat(maxAlarmRate);
      if (isNaN(alarmRate) || alarmRate < 0 || alarmRate > 1) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PARAMETER',
          message: 'maxAlarmRate must be between 0 and 1'
        });
      }
      options.maxAlarmRate = alarmRate;
    }

    if (maxRoutes) {
      const routes = parseInt(maxRoutes, 10);
      if (isNaN(routes) || routes < 1 || routes > 20) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PARAMETER',
          message: 'maxRoutes must be between 1 and 20'
        });
      }
      options.maxRoutes = routes;
    }

    if (routeType) {
      const validTypes = ['SEA', 'AIR', 'LAND', 'MULTIMODAL'];
      if (!validTypes.includes(routeType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PARAMETER',
          message: `routeType must be one of: ${validTypes.join(', ')}`
        });
      }
      options.routeType = routeType.toUpperCase();
    }

    console.log(`[RouteOptimizationController] Request: ${origin} → ${destination}`);
    console.log(`[RouteOptimizationController] Options:`, options);

    // Execute service
    const result = await getOptimalRoutes(origin, destination, options);

    // Handle different response scenarios
    if (!result.success) {
      const statusCode = result.error === 'PORT_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    if (result.routes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NO_ROUTES_FOUND',
        message: `No routes found from ${origin} to ${destination} with given constraints`,
        metadata: result.metadata
      });
    }

    // Return successful result
    res.status(200).json(result);

  } catch (err) {
    console.error('[RouteOptimizationController] Error:', err);
    return next(err);
  }
}

module.exports = { 
  ingestTelemetryController,
  traceRouteController,
  routeOptimizationController
};

