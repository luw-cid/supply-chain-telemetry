/**
 * ============================================================================
 * MongoDB Index Creation Script
 * ============================================================================
 * Description: Tạo indexes tối ưu cho Trace Route queries
 * Author: Senior Database Engineer
 * Created: 2026-03-01
 * ============================================================================
 * 
 * USAGE:
 * node src/database/mongo/create_indexes.js
 * 
 * hoặc trong MongoDB shell:
 * load('src/database/mongo/create_indexes.js')
 * ============================================================================
 */

const mongoose = require('mongoose');
const TelemetryPoints = require('../../models/mongodb/telemetry_points');

/**
 * Create optimized indexes for trace route queries
 */
async function createTraceRouteIndexes() {
  try {
    console.log('[Index Creation] Starting...');
    
    // ========================================================================
    // INDEX 1: Compound Index for Trace Route Queries
    // ========================================================================
    // Purpose: Filter by shipment_id + sort by timestamp
    // Query pattern: db.telemetry_points.find({ "meta.shipment_id": "..." }).sort({ t: 1 })
    // Benefits:
    //   - Index-only scan (no collection scan)
    //   - No in-memory sort needed
    //   - Covering index for common queries
    // ========================================================================
    console.log('[Index 1] Creating compound index: { "meta.shipment_id": 1, "t": 1 }');
    await TelemetryPoints.collection.createIndex(
      { 
        'meta.shipment_id': 1,
        't': 1
      },
      {
        name: 'idx_shipment_time',
        background: true  // Non-blocking index creation
      }
    );
    console.log('[Index 1] ✓ Created successfully');
    
    // ========================================================================
    // INDEX 2: Geospatial Index (2dsphere)
    // ========================================================================
    // Purpose: Geospatial queries (nearby points, route visualization)
    // Query pattern: db.telemetry_points.find({ location: { $near: ... } })
    // Benefits:
    //   - Fast geospatial queries
    //   - Support for $geoNear, $geoWithin, $near
    // ========================================================================
    console.log('[Index 2] Creating 2dsphere index: { "location": "2dsphere" }');
    await TelemetryPoints.collection.createIndex(
      { 
        'location': '2dsphere'
      },
      {
        name: 'idx_location_geo',
        background: true
      }
    );
    console.log('[Index 2] ✓ Created successfully');
    
    // ========================================================================
    // INDEX 3: Device ID Index (Optional)
    // ========================================================================
    // Purpose: Query by device (troubleshooting, device analytics)
    // Query pattern: db.telemetry_points.find({ "meta.device_id": "..." })
    // ========================================================================
    console.log('[Index 3] Creating device index: { "meta.device_id": 1, "t": 1 }');
    await TelemetryPoints.collection.createIndex(
      { 
        'meta.device_id': 1,
        't': 1
      },
      {
        name: 'idx_device_time',
        background: true
      }
    );
    console.log('[Index 3] ✓ Created successfully');
    
    // ========================================================================
    // INDEX 4: Temperature Range Index (Optional)
    // ========================================================================
    // Purpose: Find violations quickly
    // Query pattern: db.telemetry_points.find({ temp: { $gt: threshold } })
    // ========================================================================
    console.log('[Index 4] Creating temp index: { "meta.shipment_id": 1, "temp": 1 }');
    await TelemetryPoints.collection.createIndex(
      { 
        'meta.shipment_id': 1,
        'temp': 1
      },
      {
        name: 'idx_shipment_temp',
        background: true
      }
    );
    console.log('[Index 4] ✓ Created successfully');
    
    // ========================================================================
    // Verify Indexes
    // ========================================================================
    console.log('\n[Verification] Listing all indexes:');
    const indexes = await TelemetryPoints.collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // ========================================================================
    // Index Statistics
    // ========================================================================
    console.log('\n[Statistics] Collection stats:');
    const stats = await TelemetryPoints.collection.stats();
    console.log(`  - Total documents: ${stats.count}`);
    console.log(`  - Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Index size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Number of indexes: ${stats.nindexes}`);
    
    console.log('\n[Index Creation] ✓ All indexes created successfully!');
    
  } catch (error) {
    console.error('[Index Creation] ✗ Error:', error);
    throw error;
  }
}

/**
 * Drop all custom indexes (for testing/reset)
 */
async function dropTraceRouteIndexes() {
  try {
    console.log('[Index Deletion] Starting...');
    
    const indexesToDrop = [
      'idx_shipment_time',
      'idx_location_geo',
      'idx_device_time',
      'idx_shipment_temp'
    ];
    
    for (const indexName of indexesToDrop) {
      try {
        await TelemetryPoints.collection.dropIndex(indexName);
        console.log(`[Index Deletion] ✓ Dropped: ${indexName}`);
      } catch (error) {
        console.log(`[Index Deletion] ⚠ Index not found: ${indexName}`);
      }
    }
    
    console.log('[Index Deletion] ✓ Completed');
    
  } catch (error) {
    console.error('[Index Deletion] ✗ Error:', error);
    throw error;
  }
}

/**
 * Analyze index usage
 */
async function analyzeIndexUsage() {
  try {
    console.log('[Index Analysis] Analyzing index usage...');
    
    const indexStats = await TelemetryPoints.aggregate([
      { $indexStats: {} }
    ]);
    
    console.log('\n[Index Analysis] Usage statistics:');
    for (const stat of indexStats) {
      console.log(`\nIndex: ${stat.name}`);
      console.log(`  - Accesses: ${stat.accesses.ops}`);
      console.log(`  - Since: ${stat.accesses.since}`);
    }
    
  } catch (error) {
    console.error('[Index Analysis] ✗ Error:', error);
    throw error;
  }
}

// ============================================================================
// Export functions
// ============================================================================
module.exports = {
  createTraceRouteIndexes,
  dropTraceRouteIndexes,
  analyzeIndexUsage
};

// ============================================================================
// CLI Execution
// ============================================================================
if (require.main === module) {
  const mongoConfig = require('../../configs/mongodb.config');
  
  mongoose.connect(mongoConfig.uri, mongoConfig.options)
    .then(async () => {
      console.log('[MongoDB] Connected successfully');
      
      // Parse command line arguments
      const command = process.argv[2] || 'create';
      
      switch (command) {
        case 'create':
          await createTraceRouteIndexes();
          break;
        case 'drop':
          await dropTraceRouteIndexes();
          break;
        case 'analyze':
          await analyzeIndexUsage();
          break;
        default:
          console.log('Usage: node create_indexes.js [create|drop|analyze]');
      }
      
      await mongoose.disconnect();
      console.log('[MongoDB] Disconnected');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MongoDB] Connection error:', error);
      process.exit(1);
    });
}
