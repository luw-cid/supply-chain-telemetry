/**
 * ============================================================================
 * TRACE ROUTE SERVICE
 * ============================================================================
 * FEATURES:
 * ============================================================================
 * 1. Real-time Route Tracing:
 *    - Lấy tất cả telemetry points của shipment theo thứ tự thời gian
 *    - Trả về GeoJSON FeatureCollection để render trên map
 *    - Hỗ trợ downsampling cho large datasets
 * 
 * 2. Violation Detection:
 *    - So sánh temperature với threshold từ CargoProfile
 *    - Phân loại severity: WARNING, HIGH, CRITICAL
 *    - Tính toán violation rate và statistics
 * 
 * 3. Performance Optimization:
 *    - Adaptive downsampling dựa trên data volume
 *    - Index-optimized queries
 *    - Efficient aggregation pipeline
 * 
 * 4. Data Validation:
 *    - Kiểm tra shipment tồn tại trong MySQL
 *    - Lấy cargo profile để xác định temp threshold
 *    - Handle edge cases (no data, invalid shipment)
 * 
 * BUSINESS RULES:
 * ============================================================================
 * - Chỉ trace được shipment đã có telemetry data
 * - Temperature threshold lấy từ CargoProfile.TempMax
 * - Route points được sắp xếp theo timestamp tăng dần
 * - Downsampling tự động khi > maxPoints (default: 1000)
 * ============================================================================
 */

const { traceRouteAggregation } = require('../database/mongo/trace_route_aggregation');
const { findShipmentDetailsById } = require('../repositories/shipment.repository');
const AppError = require('../utils/app-error');

/**
 * ============================================================================
 * MAIN SERVICE: Trace Route
 * ============================================================================
 * 
 * @param {string} shipmentId - ID của shipment cần trace
 * @param {Object} options - Optional parameters
 * @param {number} options.maxPoints - Số điểm tối đa trả về (default: 1000)
 * @returns {Promise<Object>} GeoJSON FeatureCollection với route data
 * 
 * WORKFLOW:
 * ============================================================================
 * 1. Validate shipment existence trong MySQL
 * 2. Lấy cargo profile để xác định temp threshold
 * 3. Execute aggregation pipeline trên MongoDB
 * 4. Return GeoJSON FeatureCollection với metadata
 * 
 * ERROR HANDLING:
 * ============================================================================
 * - 404: Shipment not found
 * - 404: No telemetry data available
 * - 500: Database errors, aggregation failures
 * ============================================================================
 */
async function traceRoute(shipmentId, options = {}) {
  try {
    console.log(`[TraceRouteService] Starting trace for shipment: ${shipmentId}`);
    
    // ========================================================================
    // STEP 1: Validate Shipment & Get Cargo Profile
    // ========================================================================
    // RATIONALE: Cần temp threshold từ CargoProfile để detect violations
    // QUERY: JOIN Shipments với CargoProfiles
    // PERFORMANCE: Single query với JOIN, indexed lookup
    // ========================================================================
    const shipmentDetails = await findShipmentDetailsById(shipmentId);
    
    if (!shipmentDetails) {
      throw new AppError(`Shipment not found: ${shipmentId}`, 404);
    }


    // Extract temperature threshold từ cargo profile
    const tempThreshold = parseFloat(shipmentDetails.TempMax);
    
    console.log(`[TraceRouteService] Shipment found: ${shipmentId}`);
    console.log(`[TraceRouteService] Cargo Profile: ${shipmentDetails.CargoProfileID}`);
    console.log(`[TraceRouteService] Temp Threshold: ${tempThreshold}°C`);
    // - shipmentId: Filter telemetry points
    // - tempThreshold: For violation detection
    // - maxPoints: Downsampling limit (default: 1000)
    // 
    // PERFORMANCE CONSIDERATIONS:
    // - Pipeline sử dụng indexes: { "meta.shipment_id": 1, "t": 1 }
    // - Downsampling giảm data transfer và rendering load
    // - allowDiskUse: true cho large datasets
    // ========================================================================
    const maxPoints = options.maxPoints || 1000;
    
    const result = await traceRouteAggregation(
      shipmentId,
      tempThreshold,
      maxPoints
    );

    // ========================================================================
    // STEP 3: Validate Result & Handle Edge Cases
    // ========================================================================
    if (!result.features || result.features.length === 0) {
      throw new AppError(
        `No telemetry data available for shipment: ${shipmentId}`,
        404
      );
    }

    // ========================================================================
    // STEP 4: Enrich Metadata với Shipment Info
    // ========================================================================
    // ADD: Shipment details, cargo profile info, route info
    // PURPOSE: Provide complete context cho frontend visualization
    // ========================================================================
    result.metadata.shipment_details = {
      shipment_id: shipmentDetails.ShipmentID,
      cargo_profile_id: shipmentDetails.CargoProfileID,
      origin_port: shipmentDetails.OriginPortCode,
      destination_port: shipmentDetails.DestinationPortCode,
      current_status: shipmentDetails.Status,
      current_location: shipmentDetails.CurrentLocation,
      weight_kg: shipmentDetails.WeightKg
    };

    result.metadata.cargo_constraints = {
      temp_min: shipmentDetails.TempMin,
      temp_max: shipmentDetails.TempMax,
      humidity_min: shipmentDetails.HumidityMin,
      humidity_max: shipmentDetails.HumidityMax,
      max_transit_hours: shipmentDetails.MaxTransitHours
    };

    // ========================================================================
    // STEP 5: Calculate Route Statistics
    // ========================================================================
    const features = result.features;
    
    if (features.length > 1) {
      // Tính total distance (approximate, using Haversine formula)
      let totalDistance = 0;
      for (let i = 1; i < features.length; i++) {
        const [lng1, lat1] = features[i - 1].geometry.coordinates;
        const [lng2, lat2] = features[i].geometry.coordinates;
        totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
      }

      // Tính duration
      const startTime = new Date(features[0].properties.timestamp);
      const endTime = new Date(features[features.length - 1].properties.timestamp);
      const durationHours = (endTime - startTime) / (1000 * 60 * 60);

      result.metadata.route_statistics = {
        total_distance_km: totalDistance.toFixed(2),
        duration_hours: durationHours.toFixed(2),
        avg_speed_kmh: durationHours > 0 
          ? (totalDistance / durationHours).toFixed(2) 
          : 0,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      };
    }

    console.log(`[TraceRouteService] Trace completed successfully`);
    console.log(`[TraceRouteService] Returned ${features.length} points`);
    
    return result;

  } catch (error) {
    console.error('[TraceRouteService] Error:', error);
    
    // Re-throw AppError as-is
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      `Failed to trace route: ${error.message}`,
      500
    );
  }
}

/**
 * ============================================================================
 * HELPER: Calculate Distance between two coordinates
 * ============================================================================
 * Algorithm: Haversine formula
 * Input: lat/lng in degrees
 * Output: distance in kilometers
 * Accuracy: ~0.5% error for typical distances
 * ============================================================================
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * ============================================================================
 * EXPORT
 * ============================================================================
 */
module.exports = {
  traceRoute
};
