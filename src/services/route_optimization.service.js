/**
 * ============================================================================
 * ROUTE OPTIMIZATION SERVICE
 * ============================================================================
 * Business logic layer cho Route Optimization feature (BR-14)
 * Kết hợp MongoDB $graphLookup với business rules và caching
 * ============================================================================
 */

const { findOptimalRoutes, getRouteStatistics } = require('../database/mongo/route_optimization_aggregation');
const PortEdges = require('../models/mongodb/port_edges');

/**
 * ============================================================================
 * PUBLIC API: Get Optimal Routes
 * ============================================================================
 * Main entry point cho route optimization
 * Includes validation, caching, và business logic
 */
async function getOptimalRoutes(originPort, destinationPort, options = {}) {
  try {
    // Input validation
    if (!originPort || !destinationPort) {
      return {
        success: false,
        error: 'INVALID_INPUT',
        message: 'Origin and destination ports are required'
      };
    }

    // Normalize port codes (uppercase)
    const origin = originPort.toUpperCase().trim();
    const destination = destinationPort.toUpperCase().trim();

    if (origin === destination) {
      return {
        success: false,
        error: 'SAME_PORT',
        message: 'Origin and destination cannot be the same'
      };
    }

    // Validate ports exist in database
    const portsExist = await validatePorts(origin, destination);
    if (!portsExist.valid) {
      return {
        success: false,
        error: 'PORT_NOT_FOUND',
        message: portsExist.message
      };
    }

    // Execute route optimization
    const result = await findOptimalRoutes(origin, destination, options);

    // Add recommendations and insights
    if (result.success && result.routes.length > 0) {
      result.insights = generateInsights(result.routes);
    }

    return result;

  } catch (error) {
    console.error('[RouteOptimizationService] Error:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    };
  }
}

/**
 * ============================================================================
 * Compare Multiple Routes
 * ============================================================================
 * So sánh chi tiết giữa các routes
 */
async function compareRoutes(routes) {
  try {
    if (!routes || routes.length < 2) {
      throw new Error('At least 2 routes required for comparison');
    }

    const comparison = {
      routes: routes.map((route, index) => ({
        route_id: index + 1,
        path: route.path,
        metrics: {
          total_hours: route.summary.total_hours,
          total_distance_km: route.summary.total_distance_km,
          total_stops: route.summary.total_stops,
          avg_alarm_rate: route.summary.avg_alarm_rate,
          max_alarm_rate: route.summary.max_alarm_rate
        }
      })),
      best_by_time: null,
      best_by_safety: null,
      best_by_stops: null,
      overall_recommendation: null
    };

    // Find best route by each criterion
    comparison.best_by_time = routes.reduce((best, current) =>
      current.summary.total_hours < best.summary.total_hours ? current : best
    );

    comparison.best_by_safety = routes.reduce((best, current) =>
      current.summary.avg_alarm_rate < best.summary.avg_alarm_rate ? current : best
    );

    comparison.best_by_stops = routes.reduce((best, current) =>
      current.summary.total_stops < best.summary.total_stops ? current : best
    );

    // Overall recommendation (lowest optimization score)
    comparison.overall_recommendation = routes[0]; // Already sorted by score

    return comparison;

  } catch (error) {
    console.error('[CompareRoutes] Error:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * Get Route Recommendations for Cargo Type
 * ============================================================================
 * Gợi ý routes phù hợp với loại hàng hoá cụ thể
 */
async function getRouteRecommendationsForCargo(originPort, destinationPort, cargoProfile) {
  try {
    const {
      cargo_type,        // 'VACCINE', 'ELECTRONICS', 'FOOD', etc.
      temp_min,
      temp_max,
      humidity_max,
      is_fragile
    } = cargoProfile;

    // Adjust constraints based on cargo type
    let maxAlarmRate = 0.1;  // Default 10%
    let maxTransitStops = 3;

    // Stricter constraints for sensitive cargo
    if (cargo_type === 'VACCINE' || cargo_type === 'PHARMACEUTICAL') {
      maxAlarmRate = 0.05;   // Only 5% alarm rate
      maxTransitStops = 2;   // Minimize handling
    } else if (cargo_type === 'ELECTRONICS' || is_fragile) {
      maxAlarmRate = 0.08;
      maxTransitStops = 2;
    }

    // Find routes with adjusted constraints
    const result = await getOptimalRoutes(originPort, destinationPort, {
      maxAlarmRate,
      maxTransitStops,
      maxRoutes: 3  // Top 3 only for sensitive cargo
    });

    if (result.success) {
      result.cargo_specific_notes = {
        cargo_type,
        applied_constraints: {
          max_alarm_rate: maxAlarmRate,
          max_transit_stops: maxTransitStops
        },
        recommendations: generateCargoSpecificRecommendations(cargo_type, result.routes)
      };
    }

    return result;

  } catch (error) {
    console.error('[CargoRecommendations] Error:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Validate that ports exist in database
 */
async function validatePorts(originPort, destinationPort) {
  try {
    // Check if there are any edges from origin
    const originExists = await PortEdges.exists({ from_port: originPort });
    
    // Check if there are any edges to destination
    const destinationExists = await PortEdges.exists({ to_port: destinationPort });

    if (!originExists) {
      return {
        valid: false,
        message: `Origin port ${originPort} not found in database`
      };
    }

    if (!destinationExists) {
      return {
        valid: false,
        message: `Destination port ${destinationPort} not found in database`
      };
    }

    return { valid: true };

  } catch (error) {
    console.error('[ValidatePorts] Error:', error);
    return {
      valid: false,
      message: 'Database error during port validation'
    };
  }
}

/**
 * Generate insights from routes
 */
function generateInsights(routes) {
  if (!routes || routes.length === 0) {
    return null;
  }

  const topRoute = routes[0];
  const insights = [];

  // Time insight
  if (topRoute.summary.total_hours < 100) {
    insights.push({
      type: 'FAST_DELIVERY',
      message: `Fastest route delivers in ${topRoute.summary.total_hours} hours (< 5 days)`
    });
  }

  // Safety insight
  if (topRoute.summary.max_alarm_rate < 0.05) {
    insights.push({
      type: 'HIGH_SAFETY',
      message: 'Top route has excellent safety record (< 5% alarm rate)'
    });
  } else if (topRoute.summary.max_alarm_rate > 0.08) {
    insights.push({
      type: 'SAFETY_WARNING',
      message: 'Consider additional monitoring - route has elevated risk level'
    });
  }

  // Direct route insight
  if (topRoute.summary.total_stops === 0) {
    insights.push({
      type: 'DIRECT_ROUTE',
      message: 'Direct route available - no transit stops required'
    });
  }

  // Multiple options insight
  if (routes.length > 3) {
    insights.push({
      type: 'MULTIPLE_OPTIONS',
      message: `${routes.length} alternative routes available for flexibility`
    });
  }

  return insights;
}

/**
 * Generate cargo-specific recommendations
 */
function generateCargoSpecificRecommendations(cargoType, routes) {
  const recommendations = [];

  if (cargoType === 'VACCINE' || cargoType === 'PHARMACEUTICAL') {
    recommendations.push('Use temperature-controlled containers throughout journey');
    recommendations.push('Enable real-time temperature monitoring');
    recommendations.push('Minimize transit stops to reduce handling risk');
    
    if (routes[0]?.summary.total_hours > 72) {
      recommendations.push('Route exceeds 72 hours - verify cold chain capacity');
    }
  }

  if (cargoType === 'ELECTRONICS') {
    recommendations.push('Use humidity-controlled containers');
    recommendations.push('Avoid routes with high humidity exposure');
    recommendations.push('Consider insurance for high-value cargo');
  }

  if (cargoType === 'FOOD' || cargoType === 'PERISHABLE') {
    recommendations.push('Verify refrigeration availability at all transit points');
    recommendations.push('Plan for customs clearance delays');
    
    if (routes[0]?.summary.total_stops > 1) {
      recommendations.push('Multiple stops increase spoilage risk');
    }
  }

  return recommendations;
}

/**
 * ============================================================================
 * BATCH OPERATIONS
 * ============================================================================
 */

/**
 * Get optimal routes for multiple origin-destination pairs
 * Useful for route planning optimization
 */
async function batchOptimizeRoutes(routePairs, options = {}) {
  try {
    const results = [];

    for (const pair of routePairs) {
      const result = await getOptimalRoutes(
        pair.origin,
        pair.destination,
        options
      );

      results.push({
        origin: pair.origin,
        destination: pair.destination,
        ...result
      });
    }

    return {
      success: true,
      total_pairs: routePairs.length,
      results
    };

  } catch (error) {
    console.error('[BatchOptimize] Error:', error);
    throw error;
  }
}

module.exports = {
  getOptimalRoutes,
  compareRoutes,
  getRouteRecommendationsForCargo,
  batchOptimizeRoutes,
  getRouteStatistics
};
