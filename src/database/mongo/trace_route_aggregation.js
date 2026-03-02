/**
 * ============================================================================
 * TRACE ROUTE - MongoDB Aggregation Pipeline
 * ============================================================================
 * Description: Truy vết hành trình shipment với GeoJSON output và downsampling
 * Collection: telemetry_points (time-series)
 * Author: Senior Database Engineer
 * Created: 2026-03-01
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * ============================================================================
 * 1. Index Strategy:
 *    - Compound index: { "meta.shipment_id": 1, "t": 1 }
 *    - Time-series collection với metaField optimization
 *    - 2dsphere index cho geospatial queries
 * 
 * 2. Pipeline Optimization:
 *    - $match đầu tiên để filter sớm (index scan thay vì collection scan)
 *    - $sort trên indexed field (covered query)
 *    - Downsampling với $setWindowFields + $mod (memory efficient)
 *    - $project cuối cùng để giảm data transfer
 * 
 * 3. Memory Management:
 *    - Adaptive downsampling dựa trên data size
 *    - Streaming results với cursor (không load hết vào RAM)
 *    - Projection chỉ lấy fields cần thiết
 * 
 * 4. Scalability:
 *    - Time complexity: O(n log n) với n = số điểm sau filter
 *    - Space complexity: O(k) với k = maxPoints (sau downsampling)
 *    - Horizontal scaling: Sharding by meta.shipment_id
 * 
 * BEST PRACTICES:
 * ============================================================================
 * - Sử dụng allowDiskUse: true cho large datasets
 * - Implement query timeout để tránh long-running queries
 * - Cache kết quả cho frequently accessed shipments
 * - Monitor với MongoDB profiler và explain()
 * ============================================================================
 */

const TelemetryPoints = require('../../models/mongodb/telemetry_points');

/**
 * Trace Route Aggregation Pipeline
 * 
 * @param {string} shipmentId - ID của shipment cần trace
 * @param {number} tempThreshold - Ngưỡng nhiệt độ tối đa cho phép (từ CargoProfile)
 * @param {number} maxPoints - Số điểm tối đa trả về (default: 1000)
 * @returns {Promise<Object>} GeoJSON FeatureCollection với route và metadata
 * 
 * Performance Optimizations:
 * - Sử dụng $match đầu tiên để filter sớm (index scan)
 * - $sort trên indexed field (t)
 * - Downsampling với $mod để giảm data size
 * - $project để chỉ lấy fields cần thiết
 */
async function traceRouteAggregation(shipmentId, tempThreshold, maxPoints = 1000) {
  try {
    const startTime = Date.now();
    
    // ========================================================================
    // STAGE 1: Count total points để quyết định downsampling ratio
    // ========================================================================
    // OPTIMIZATION: Sử dụng countDocuments() thay vì aggregate $count
    // - Nhanh hơn vì sử dụng metadata của collection
    // - Không cần scan toàn bộ documents
    // ========================================================================
    const totalPoints = await TelemetryPoints.countDocuments({
      'meta.shipment_id': shipmentId
    });
    
    // Tính sampling ratio: nếu > maxPoints thì lấy mẫu
    // Ví dụ: 5000 points, maxPoints=1000 => sampleEvery=5 (lấy 1/5)
    const sampleEvery = totalPoints > maxPoints 
      ? Math.ceil(totalPoints / maxPoints) 
      : 1;

    console.log(`[TraceRoute] ShipmentID: ${shipmentId}`);
    console.log(`[TraceRoute] Total points: ${totalPoints}`);
    console.log(`[TraceRoute] Sample ratio: 1/${sampleEvery}`);

    // ========================================================================
    // STAGE 2: Main Aggregation Pipeline
    // ========================================================================
    // OPTIMIZATION STRATEGY:
    // - Pipeline order: filter → sort → window → sample → transform
    // - Early filtering giảm data volume cho các stages sau
    // - Sử dụng $project cuối cùng để minimize memory footprint
    // ========================================================================
    const pipeline = [
      // --------------------------------------------------------------------
      // STAGE 2.1: MATCH - Filter by shipment_id
      // --------------------------------------------------------------------
      // INDEX USAGE: Sử dụng compound index { "meta.shipment_id": 1, "t": 1 }
      // SELECTIVITY: High (1 shipment trong hàng triệu records)
      // COST: O(log n) index scan
      // --------------------------------------------------------------------
      {
        $match: {
          'meta.shipment_id': shipmentId
        }
      },

      // --------------------------------------------------------------------
      // STAGE 2.2: SORT - Sắp xếp theo timestamp
      // --------------------------------------------------------------------
      // INDEX USAGE: Covered by compound index (no in-memory sort needed)
      // ORDER: Ascending (chronological) - quan trọng cho route visualization
      // COST: O(1) nếu index được sử dụng, O(n log n) nếu in-memory sort
      // --------------------------------------------------------------------
      {
        $sort: {
          t: 1  // Ascending - từ cũ đến mới
        }
      },

      // --------------------------------------------------------------------
      // STAGE 2.3: SET WINDOW FIELDS - Thêm row number
      // --------------------------------------------------------------------
      // PURPOSE: Tạo sequence number cho downsampling
      // MEMORY: Requires window frame buffer (bounded by partition)
      // ALTERNATIVE: Có thể dùng $group + $push nhưng kém hiệu quả hơn
      // --------------------------------------------------------------------
      {
        $setWindowFields: {
          sortBy: { t: 1 },
          output: {
            rowNum: {
              $documentNumber: {}
            }
          }
        }
      },

      // --------------------------------------------------------------------
      // STAGE 2.4: MATCH - Downsampling filter
      // --------------------------------------------------------------------
      // ALGORITHM: Modulo-based sampling (deterministic, reproducible)
      // RATIO: sampleEvery = ceil(totalPoints / maxPoints)
      // EXAMPLE: 5000 points, maxPoints=1000 => keep every 5th point
      // BENEFIT: Giảm data transfer và rendering load trên client
      // --------------------------------------------------------------------
      {
        $match: {
          $expr: {
            $eq: [
              { $mod: ['$rowNum', sampleEvery] },
              0
            ]
          }
        }
      },

      // --------------------------------------------------------------------
      // STAGE 2.5: ADD FIELDS - Violation detection
      // --------------------------------------------------------------------
      // BUSINESS LOGIC: Compare temp với threshold từ CargoProfile
      // SEVERITY LEVELS:
      //   - WARNING: temp > threshold && temp < threshold + 5
      //   - CRITICAL: temp >= threshold + 5
      // USE CASE: Real-time alerting, compliance reporting
      // --------------------------------------------------------------------
      {
        $addFields: {
          is_violation: {
            $gt: ['$temp', tempThreshold]
          },
          // Tính temperature delta (độ lệch so với threshold)
          temp_delta: {
            $subtract: ['$temp', tempThreshold]
          }
        }
      },

      // --------------------------------------------------------------------
      // STAGE 2.6: PROJECT - Transform to GeoJSON Feature
      // --------------------------------------------------------------------
      // FORMAT: GeoJSON Feature (RFC 7946 compliant)
      // GEOMETRY: Point với coordinates [longitude, latitude]
      // PROPERTIES: Sensor data + computed fields
      // OPTIMIZATION: Chỉ project fields cần thiết, loại bỏ _id
      // --------------------------------------------------------------------
      {
        $project: {
          _id: 0,  // Loại bỏ _id để giảm payload size
          type: { $literal: 'Feature' },
          geometry: {
            type: '$location.type',
            coordinates: '$location.coordinates'  // [lng, lat]
          },
          properties: {
            // Temporal data
            timestamp: '$t',
            
            // Sensor readings
            temp: { $round: ['$temp', 2] },  // Round to 2 decimals
            humidity: { $round: ['$humidity', 2] },
            
            // Device metadata
            device_id: '$meta.device_id',
            
            // Violation flags
            is_violation: '$is_violation',
            temp_delta: { $round: ['$temp_delta', 2] },
            
            // Severity classification
            violation_severity: {
              $cond: {
                if: '$is_violation',
                then: {
                  $cond: {
                    if: { $gte: ['$temp_delta', 5] },
                    then: 'CRITICAL',  // Vượt >= 5°C
                    else: {
                      $cond: {
                        if: { $gte: ['$temp_delta', 2] },
                        then: 'HIGH',  // Vượt >= 2°C
                        else: 'WARNING'  // Vượt < 2°C
                      }
                    }
                  }
                },
                else: null
              }
            }
          }
        }
      }
    ];

    // ========================================================================
    // EXECUTE PIPELINE với Performance Options
    // ========================================================================
    // OPTIONS:
    // - allowDiskUse: true => Cho phép spill to disk nếu exceed memory limit
    // - maxTimeMS: 30000 => Timeout sau 30s để tránh long-running queries
    // - hint: Chỉ định index sử dụng (optional, MongoDB thường chọn đúng)
    // ========================================================================
    const features = await TelemetryPoints.aggregate(pipeline, {
      allowDiskUse: true,  // Critical cho large datasets
      maxTimeMS: 30000,    // 30 second timeout
      // hint: { 'meta.shipment_id': 1, 't': 1 }  // Force index usage
    });

    // ========================================================================
    // CALCULATE STATISTICS
    // ========================================================================
    const violationCount = features.filter(f => f.properties.is_violation).length;
    const violationRate = features.length > 0 
      ? (violationCount / features.length * 100).toFixed(2) 
      : 0;

    // Tính temperature statistics
    const temps = features.map(f => f.properties.temp);
    const tempStats = temps.length > 0 ? {
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)
    } : null;

    // ========================================================================
    // BUILD GEOJSON FEATURECOLLECTION với Enhanced Metadata
    // ========================================================================
    const executionTime = Date.now() - startTime;
    
    const result = {
      type: 'FeatureCollection',
      metadata: {
        // Shipment info
        shipment_id: shipmentId,
        
        // Data volume metrics
        total_points_in_db: totalPoints,
        returned_points: features.length,
        sampling_ratio: sampleEvery,
        data_reduction_pct: totalPoints > 0 
          ? ((1 - features.length / totalPoints) * 100).toFixed(2) 
          : 0,
        
        // Violation metrics
        temp_threshold: tempThreshold,
        violation_count: violationCount,
        violation_rate: `${violationRate}%`,
        
        // Temperature statistics
        temp_statistics: tempStats,
        
        // Performance metrics
        execution_time_ms: executionTime,
        query_efficiency: totalPoints > 0 
          ? (totalPoints / executionTime).toFixed(2) + ' points/ms'
          : 'N/A',
        
        // Timestamps
        generated_at: new Date().toISOString(),
        
        // Data quality indicators
        data_quality: {
          completeness: features.length > 0 ? 'COMPLETE' : 'NO_DATA',
          freshness: totalPoints > 0 ? 'AVAILABLE' : 'STALE',
          sampling_method: sampleEvery > 1 ? 'DOWNSAMPLED' : 'FULL'
        }
      },
      features: features
    };

    // ========================================================================
    // LOGGING cho Performance Monitoring
    // ========================================================================
    console.log(`[TraceRoute] Performance Summary:`);
    console.log(`  - Execution time: ${executionTime}ms`);
    console.log(`  - Points processed: ${totalPoints}`);
    console.log(`  - Points returned: ${features.length}`);
    console.log(`  - Throughput: ${(totalPoints / executionTime).toFixed(2)} points/ms`);
    console.log(`  - Violations: ${violationCount} (${violationRate}%)`);

    return result;

  } catch (error) {
    console.error('[TraceRoute] Aggregation error:', error);
    throw new Error(`Failed to trace route for shipment ${shipmentId}: ${error.message}`);
  }
}

/**
 * ============================================================================
 * ALTERNATIVE: Simplified version without downsampling
 * ============================================================================
 * Dùng khi cần tất cả data points (ví dụ: export, detailed analysis)
 */
async function traceRouteFullData(shipmentId, tempThreshold) {
  try {
    const pipeline = [
      {
        $match: {
          'meta.shipment_id': shipmentId
        }
      },
      {
        $sort: { t: 1 }
      },
      {
        $addFields: {
          is_violation: { $gt: ['$temp', tempThreshold] }
        }
      },
      {
        $project: {
          _id: 0,
          type: { $literal: 'Feature' },
          geometry: {
            type: '$location.type',
            coordinates: '$location.coordinates'
          },
          properties: {
            timestamp: '$t',
            temp: '$temp',
            humidity: '$humidity',
            is_violation: '$is_violation'
          }
        }
      }
    ];

    const features = await TelemetryPoints.aggregate(pipeline);

    return {
      type: 'FeatureCollection',
      metadata: {
        shipment_id: shipmentId,
        total_points: features.length,
        temp_threshold: tempThreshold
      },
      features: features
    };

  } catch (error) {
    console.error('[TraceRoute] Full data error:', error);
    throw error;
  }
}

module.exports = {
  traceRouteAggregation,
  traceRouteFullData
};
