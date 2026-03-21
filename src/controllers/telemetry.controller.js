const { ingestTelemetry } = require('../services/saga-orchestrator');
const { traceRoute } = require('../services/trace_route.service');

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

module.exports = { 
  ingestTelemetryController,
  traceRouteController
};

