/**
 * ============================================================================
 * ROUTE OPTIMIZATION - MongoDB $graphLookup Implementation
 * ============================================================================
 * Description: Tìm lộ trình tối ưu giữa 2 cảng sử dụng Graph Traversal
 * Collection: port_edges
 * 
 * GRAPH ALGORITHM STRATEGY:
 * ============================================================================
 * 1. Graph Representation:
 *    - Nodes: Ports (VNSGN, SGSIN, USNYC, etc.)
 *    - Edges: port_edges collection (from_port -> to_port)
 *    - Weights: avg_hours (transit time), alarm_rate (risk factor)
 * 
 * 2. $graphLookup Mechanics:
 *    - Recursive traversal từ origin port
 *    - Depth-limited search (maxDepth) để tránh infinite loops
 *    - Filtering với restrictSearchWithMatch (loại bỏ high-risk routes)
 *    - Returns flattened array (cần post-processing để build paths)
 * 
 * 3. Path Reconstruction Algorithm:
 *    - Input: Flattened array từ $graphLookup với depthField
 *    - Process: Backtracking từ destination về origin
 *    - Output: Complete paths với total cost calculation
 * 
 * 4. Optimization Criteria:
 *    - Primary: Minimize total transit time (avg_hours)
 *    - Secondary: Minimize alarm_rate (risk avoidance)
 *    - Constraint: Max transit stops (maxDepth)
 * 
 * PERFORMANCE CONSIDERATIONS:
 * ============================================================================
 * - Index Strategy: { from_port: 1, to_port: 1, alarm_rate: 1 }
 * - Memory: $graphLookup can be memory-intensive for large graphs
 * - Scalability: Consider caching results for popular routes
 * - Alternative: Pre-compute routes for common port pairs
 * 
 * BUSINESS RULES (from BR-14):
 * ============================================================================
 * - Loại bỏ routes có alarm_rate > 10% (high risk)
 * - Ưu tiên routes có avg_hours thấp nhất
 * - Giới hạn tối đa 3 transit stops (4 legs total)
 * - Chỉ xét routes đang active (is_active = true)
 * ============================================================================
 */

const PortEdges = require('../../models/mongodb/port_edges');

/**
 * ============================================================================
 * MAIN FUNCTION: Find Optimal Routes
 * ============================================================================
 * Tìm tất cả các lộ trình khả thi từ origin đến destination,
 * sau đó rank theo total transit time và risk level
 * 
 * @param {string} originPort - Mã cảng xuất phát (e.g., "VNSGN")
 * @param {string} destinationPort - Mã cảng đích (e.g., "USNYC")
 * @param {Object} options - Tuỳ chọn tìm kiếm
 * @param {number} options.maxTransitStops - Số trạm dừng tối đa (default: 3)
 * @param {number} options.maxAlarmRate - Tỷ lệ alarm tối đa chấp nhận (default: 0.1)
 * @param {number} options.maxRoutes - Số lộ trình tối đa trả về (default: 5)
 * @returns {Promise<Object>} Danh sách routes được rank theo độ tối ưu
 */
async function findOptimalRoutes(originPort, destinationPort, options = {}) {
  try {
    const startTime = Date.now();
    
    // ========================================================================
    // CONFIGURATION & VALIDATION
    // ========================================================================
    const {
      maxTransitStops = 3,      // Tối đa 3 trạm dừng (4 chặng)
      maxAlarmRate = 0.1,       // Chỉ chấp nhận routes có alarm_rate < 10%
      maxRoutes = 5,            // Trả về top 5 routes tốt nhất
      routeType = null          // Filter theo loại vận chuyển (SEA, AIR, etc.)
    } = options;

    console.log(`[RouteOptimization] Finding routes: ${originPort} → ${destinationPort}`);
    console.log(`[RouteOptimization] Constraints: maxStops=${maxTransitStops}, maxAlarm=${maxAlarmRate}`);

    // Validate input
    if (!originPort || !destinationPort) {
      throw new Error('Origin and destination ports are required');
    }

    if (originPort === destinationPort) {
      throw new Error('Origin and destination cannot be the same');
    }

    // ========================================================================
    // STAGE 1: $graphLookup - Graph Traversal
    // ========================================================================
    // CRITICAL UNDERSTANDING (từ MongoDB Docs + YouTube Video):
    // 
    // $graphLookup KHÔNG trả về cấu trúc cây lồng nhau (nested tree)!
    // Nó trả về một MẢNG PHẲNG (flattened array) chứa tất cả nodes tìm được.
    // 
    // Ví dụ output:
    // {
    //   from_port: "VNSGN",
    //   to_port: "SGSIN",
    //   possible_routes: [
    //     { from_port: "SGSIN", to_port: "HKHKG", transit_stop: 0 },
    //     { from_port: "HKHKG", to_port: "USNYC", transit_stop: 1 },
    //     { from_port: "SGSIN", to_port: "USNYC", transit_stop: 0 },  // Direct
    //     ...
    //   ]
    // }
    // 
    // => Cần thuật toán post-processing để reconstruct paths!
    // ========================================================================

    const pipeline = [
      // --------------------------------------------------------------------
      // STAGE 1.1: MATCH - Filter starting edges from origin
      // --------------------------------------------------------------------
      // Tìm tất cả các chặng đầu tiên xuất phát từ origin port
      // INDEX USAGE: { from_port: 1 }
      // --------------------------------------------------------------------
      {
        $match: {
          from_port: originPort,
          is_active: true,
          ...(routeType && { route_type: routeType })
        }
      },

      // --------------------------------------------------------------------
      // STAGE 1.2: $graphLookup - Recursive Graph Traversal
      // --------------------------------------------------------------------
      // PARAMETERS EXPLAINED (theo MongoDB Docs):
      // 
      // - from: Collection chứa graph edges (port_edges)
      // - startWith: Điểm bắt đầu cho mỗi iteration ($to_port của edge hiện tại)
      // - connectFromField: Field của document hiện tại để match (to_port)
      // - connectToField: Field của documents trong collection để match (from_port)
      // - as: Tên array chứa kết quả (possible_routes)
      // - maxDepth: Số bước nhảy tối đa (0-indexed, 3 = 4 chặng total)
      // - depthField: Field đánh dấu độ sâu (CRITICAL cho path reconstruction!)
      // - restrictSearchWithMatch: Filter chỉ lấy edges đủ điều kiện
      // 
      // TRAVERSAL LOGIC:
      // Iteration 0: Lấy to_port của edge gốc (SGSIN)
      //              Tìm edges có from_port = SGSIN
      //              => Tìm được SGSIN->HKHKG, SGSIN->USNYC
      // Iteration 1: Lấy to_port của edges vừa tìm (HKHKG, USNYC)
      //              Tìm edges có from_port = HKHKG hoặc USNYC
      //              => Tìm được HKHKG->USNYC, HKHKG->JPTYO, etc.
      // ...
      // Iteration maxDepth: Stop
      // --------------------------------------------------------------------
      {
        $graphLookup: {
          from: 'port_edges',
          startWith: '$to_port',
          connectFromField: 'to_port',
          connectToField: 'from_port',
          as: 'possible_routes',
          maxDepth: maxTransitStops,
          depthField: 'transit_stop',
          restrictSearchWithMatch: {
            alarm_rate: { $lt: maxAlarmRate },
            is_active: true,
            ...(routeType && { route_type: routeType })
          }
        }
      },

      // --------------------------------------------------------------------
      // STAGE 1.3: PROJECT - Clean up output
      // --------------------------------------------------------------------
      {
        $project: {
          _id: 0,
          first_leg: {
            from_port: '$from_port',
            to_port: '$to_port',
            avg_hours: '$avg_hours',
            distance_km: '$distance_km',
            alarm_rate: '$alarm_rate',
            route_type: '$route_type'
          },
          possible_routes: 1
        }
      }
    ];

    // Execute aggregation
    const graphResults = await PortEdges.aggregate(pipeline, {
      allowDiskUse: true,
      maxTimeMS: 30000
    });

    console.log(`[RouteOptimization] Graph traversal found ${graphResults.length} starting edges`);

    if (graphResults.length === 0) {
      return {
        success: false,
        message: `No routes found from ${originPort}`,
        routes: [],
        metadata: {
          origin: originPort,
          destination: destinationPort,
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    // ========================================================================
    // STAGE 2: PATH RECONSTRUCTION (Application Layer)
    // ========================================================================

    const allPaths = [];

    for (const result of graphResults) {
      const firstLeg = result.first_leg;
      const possibleRoutes = result.possible_routes || [];

      // Case 1: Direct route (first leg đã đến destination)
      if (firstLeg.to_port === destinationPort) {
        allPaths.push({
          legs: [firstLeg],
          total_stops: 0,
          total_hours: firstLeg.avg_hours,
          total_distance_km: firstLeg.distance_km,
          max_alarm_rate: firstLeg.alarm_rate,
          avg_alarm_rate: firstLeg.alarm_rate,
          route_types: [firstLeg.route_type]
        });
      }

      // Case 2: Routes với transit stops
      // Tìm tất cả edges kết thúc tại destination
      const routesToDestination = possibleRoutes.filter(
        edge => edge.to_port === destinationPort
      );

      for (const finalEdge of routesToDestination) {
        // Reconstruct path từ origin -> ... -> destination
        const path = reconstructPath(
          firstLeg,
          possibleRoutes,
          finalEdge,
          destinationPort
        );

        if (path) {
          allPaths.push(path);
        }
      }
    }

    console.log(`[RouteOptimization] Reconstructed ${allPaths.length} complete paths`);

    // ========================================================================
    // STAGE 3: RANKING & OPTIMIZATION
    // ========================================================================
    // Sắp xếp routes theo multiple criteria:
    // 1. Total transit time (primary)
    // 2. Risk level / alarm_rate (secondary)
    // 3. Number of stops (tertiary)
    // ========================================================================

    const rankedRoutes = allPaths
      .map(path => ({
        ...path,
        // Tính optimization score (lower is better)
        // Formula: weighted sum of normalized metrics
        optimization_score: calculateOptimizationScore(path)
      }))
      .sort((a, b) => a.optimization_score - b.optimization_score)
      .slice(0, maxRoutes);

    // ========================================================================
    // STAGE 4: ENRICH WITH STATISTICS
    // ========================================================================
    const executionTime = Date.now() - startTime;

    const result = {
      success: true,
      routes: rankedRoutes.map((route, index) => ({
        rank: index + 1,
        path: route.legs.map(leg => leg.from_port).concat(route.legs[route.legs.length - 1].to_port),
        legs: route.legs,
        summary: {
          total_stops: route.total_stops,
          total_hours: Math.round(route.total_hours * 100) / 100,
          total_distance_km: Math.round(route.total_distance_km),
          avg_alarm_rate: Math.round(route.avg_alarm_rate * 1000) / 1000,
          max_alarm_rate: Math.round(route.max_alarm_rate * 1000) / 1000,
          route_types: [...new Set(route.route_types)],
          optimization_score: Math.round(route.optimization_score * 100) / 100
        },
        recommendation: getRecommendationLevel(route)
      })),
      metadata: {
        origin: originPort,
        destination: destinationPort,
        total_paths_found: allPaths.length,
        returned_routes: rankedRoutes.length,
        constraints: {
          max_transit_stops: maxTransitStops,
          max_alarm_rate: maxAlarmRate,
          route_type: routeType || 'ALL'
        },
        execution_time_ms: executionTime,
        generated_at: new Date().toISOString()
      }
    };

    console.log(`[RouteOptimization] Completed in ${executionTime}ms`);
    console.log(`[RouteOptimization] Top route: ${result.routes[0]?.path.join(' → ')}`);

    return result;

  } catch (error) {
    console.error('[RouteOptimization] Error:', error);
    throw new Error(`Route optimization failed: ${error.message}`);
  }
}

/**
 * ============================================================================
 * PATH RECONSTRUCTION ALGORITHM
 * ============================================================================
 * Backtracking algorithm để build complete path từ flattened array
 * 
 * STRATEGY:
 * - Start từ finalEdge (edge cuối cùng đến destination)
 * - Backtrack về origin bằng cách match to_port -> from_port
 * - Sử dụng depthField (transit_stop) để đảm bảo thứ tự đúng
 * 
 * @param {Object} firstLeg - Chặng đầu tiên từ origin
 * @param {Array} allEdges - Mảng phẳng từ $graphLookup
 * @param {Object} finalEdge - Chặng cuối cùng đến destination
 * @param {string} destination - Destination port code
 * @returns {Object|null} Complete path object hoặc null nếu không valid
 */
function reconstructPath(firstLeg, allEdges, finalEdge, destination) {
  try {
    const legs = [firstLeg];
    let currentEdge = finalEdge;
    let currentDepth = finalEdge.transit_stop;

    // Backtrack từ destination về origin
    while (currentDepth > 0) {
      // Tìm edge ở depth trước đó mà kết nối với currentEdge
      const previousEdge = allEdges.find(
        edge =>
          edge.to_port === currentEdge.from_port &&
          edge.transit_stop === currentDepth - 1
      );

      if (!previousEdge) {
        // Path không hoàn chỉnh, bỏ qua
        return null;
      }

      legs.unshift({
        from_port: previousEdge.from_port,
        to_port: previousEdge.to_port,
        avg_hours: previousEdge.avg_hours,
        distance_km: previousEdge.distance_km,
        alarm_rate: previousEdge.alarm_rate,
        route_type: previousEdge.route_type
      });

      currentEdge = previousEdge;
      currentDepth--;
    }

    // Add final leg
    legs.push({
      from_port: finalEdge.from_port,
      to_port: finalEdge.to_port,
      avg_hours: finalEdge.avg_hours,
      distance_km: finalEdge.distance_km,
      alarm_rate: finalEdge.alarm_rate,
      route_type: finalEdge.route_type
    });

    // Validate path continuity
    for (let i = 0; i < legs.length - 1; i++) {
      if (legs[i].to_port !== legs[i + 1].from_port) {
        return null; // Path không liên tục
      }
    }

    // Calculate aggregated metrics
    const totalHours = legs.reduce((sum, leg) => sum + leg.avg_hours, 0);
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance_km, 0);
    const alarmRates = legs.map(leg => leg.alarm_rate);
    const avgAlarmRate = alarmRates.reduce((sum, rate) => sum + rate, 0) / alarmRates.length;
    const maxAlarmRate = Math.max(...alarmRates);

    return {
      legs,
      total_stops: legs.length - 1,
      total_hours: totalHours,
      total_distance_km: totalDistance,
      avg_alarm_rate: avgAlarmRate,
      max_alarm_rate: maxAlarmRate,
      route_types: legs.map(leg => leg.route_type)
    };

  } catch (error) {
    console.error('[PathReconstruction] Error:', error);
    return null;
  }
}

/**
 * Calculate optimization score (lower is better)
 * Weighted formula combining multiple factors
 */
function calculateOptimizationScore(path) {
  // Weights (tunable based on business priorities)
  const WEIGHT_TIME = 0.5;        // 50% - Transit time là quan trọng nhất
  const WEIGHT_RISK = 0.3;        // 30% - Risk avoidance
  const WEIGHT_STOPS = 0.2;       // 20% - Ít trạm dừng hơn = tốt hơn

  // Normalize metrics (0-1 scale)
  const normalizedTime = path.total_hours / 1000;  // Assume max 1000 hours
  const normalizedRisk = path.avg_alarm_rate;      // Already 0-1
  const normalizedStops = path.total_stops / 3;    // Max 3 stops

  return (
    WEIGHT_TIME * normalizedTime +
    WEIGHT_RISK * normalizedRisk +
    WEIGHT_STOPS * normalizedStops
  );
}

/**
 * Get recommendation level based on route quality
 */
function getRecommendationLevel(route) {
  if (route.max_alarm_rate < 0.05 && route.total_stops <= 1) {
    return 'HIGHLY_RECOMMENDED';
  } else if (route.max_alarm_rate < 0.08 && route.total_stops <= 2) {
    return 'RECOMMENDED';
  } else if (route.max_alarm_rate < 0.1) {
    return 'ACCEPTABLE';
  } else {
    return 'USE_WITH_CAUTION';
  }
}

/**
 * ============================================================================
 * HELPER: Get Historical Route Statistics
 * ============================================================================
 * Lấy thống kê lịch sử của một route cụ thể
 * Dùng để validate và update port_edges data
 */
async function getRouteStatistics(fromPort, toPort) {
  try {
    const edge = await PortEdges.findOne({
      from_port: fromPort,
      to_port: toPort,
      is_active: true
    });

    if (!edge) {
      return null;
    }

    return {
      from_port: edge.from_port,
      to_port: edge.to_port,
      route_type: edge.route_type,
      distance_km: edge.distance_km,
      transit_time: {
        avg_hours: edge.avg_hours,
        min_hours: edge.min_hours,
        max_hours: edge.max_hours,
        std_dev_hours: edge.std_dev_hours
      },
      reliability: {
        alarm_rate: edge.alarm_rate,
        samples: edge.samples,
        last_updated: edge.last_updated
      }
    };

  } catch (error) {
    console.error('[RouteStatistics] Error:', error);
    throw error;
  }
}

module.exports = {
  findOptimalRoutes,
  getRouteStatistics
};
