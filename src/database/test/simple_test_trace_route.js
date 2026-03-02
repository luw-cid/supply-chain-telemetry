/**
 * ============================================================================
 * Simple Test Runner: Trace Route Aggregation
 * ============================================================================
 * Description: Standalone test runner không cần test framework
 * Author: Senior Database Engineer
 * Created: 2026-03-01
 * ============================================================================
 * 
 * USAGE:
 * node src/database/mongo/simple_test_trace_route.js
 * ============================================================================
 */

const mongoose = require('mongoose');
const TelemetryPoints = require('../../models/mongodb/telemetry_points');
const { traceRouteAggregation } = require('../mongo/trace_route_aggregation');

// ============================================================================
// Configuration
// ============================================================================
const CONFIG = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/supply_chain_test',
  testShipmentId: 'TEST-SHP-SIMPLE-001',
  testDeviceId: 'TEST-DEV-001'
};

// ============================================================================
// Test Utilities
// ============================================================================
class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async test(name, fn) {
    try {
      console.log(`\n▶ Running: ${name}`);
      await fn();
      console.log(`  ✓ PASSED`);
      this.passed++;
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}`);
      this.failed++;
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  }

  assertLessThan(actual, expected, message) {
    if (actual >= expected) {
      throw new Error(message || `Expected ${actual} < ${expected}`);
    }
  }

  summary() {
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total: ${this.passed + this.failed}`);
    console.log(`✓ Passed: ${this.passed}`);
    console.log(`✗ Failed: ${this.failed}`);
    console.log('='.repeat(80));
    return this.failed === 0;
  }
}

// ============================================================================
// Test Data Generator
// ============================================================================
function generateTestData(count = 100, options = {}) {
  const {
    shipmentId = CONFIG.testShipmentId,
    deviceId = CONFIG.testDeviceId,
    startTime = new Date('2024-01-15T00:00:00Z'),
    baseTemp = 6.0,
    tempVariation = 4.0
  } = options;

  const points = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * 5 * 60 * 1000);
    const temp = baseTemp + (Math.random() * tempVariation);
    const lng = 106.7 + (i / count) * 10; // Ho Chi Minh to somewhere east
    const lat = 10.8 + (i / count) * 5;

    points.push({
      meta: {
        shipment_id: shipmentId,
        device_id: deviceId
      },
      t: timestamp,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      temp: parseFloat(temp.toFixed(2)),
      humidity: parseFloat((60 + Math.random() * 20).toFixed(2))
    });
  }

  return points;
}

// ============================================================================
// Test Cases
// ============================================================================
async function runTests() {
  const runner = new TestRunner();

  console.log('\n' + '█'.repeat(80));
  console.log('TRACE ROUTE AGGREGATION - SIMPLE TEST SUITE');
  console.log('█'.repeat(80));

  // Connect to MongoDB
  console.log('\n[Setup] Connecting to MongoDB...');
  await mongoose.connect(CONFIG.mongoUri);
  console.log('[Setup] ✓ Connected');

  // Clean up test data
  console.log('[Setup] Cleaning test data...');
  await TelemetryPoints.deleteMany({ 
    'meta.shipment_id': { $regex: /^TEST-/ } 
  });
  console.log('[Setup] ✓ Cleaned');

  // ========================================================================
  // Test 1: Basic GeoJSON Format
  // ========================================================================
  await runner.test('Test 1: Should return GeoJSON FeatureCollection', async () => {
    const testData = generateTestData(100);
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    runner.assertEqual(result.type, 'FeatureCollection', 'Should be FeatureCollection');
    runner.assert(result.metadata, 'Should have metadata');
    runner.assert(Array.isArray(result.features), 'Should have features array');
  });

  // ========================================================================
  // Test 2: Metadata Structure
  // ========================================================================
  await runner.test('Test 2: Should have correct metadata structure', async () => {
    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    runner.assert(result.metadata.shipment_id, 'Should have shipment_id');
    runner.assert(result.metadata.total_points_in_db >= 0, 'Should have total_points_in_db');
    runner.assert(result.metadata.returned_points >= 0, 'Should have returned_points');
    runner.assert(result.metadata.execution_time_ms > 0, 'Should have execution_time_ms');
  });

  // ========================================================================
  // Test 3: Feature Structure
  // ========================================================================
  await runner.test('Test 3: Features should have correct structure', async () => {
    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    if (result.features.length > 0) {
      const feature = result.features[0];
      runner.assertEqual(feature.type, 'Feature', 'Feature type should be "Feature"');
      runner.assertEqual(feature.geometry.type, 'Point', 'Geometry type should be "Point"');
      runner.assert(Array.isArray(feature.geometry.coordinates), 'Should have coordinates array');
      runner.assertEqual(feature.geometry.coordinates.length, 2, 'Coordinates should have 2 elements');
      runner.assert(feature.properties.timestamp, 'Should have timestamp');
      runner.assert(typeof feature.properties.temp === 'number', 'Should have temp as number');
    }
  });

  // ========================================================================
  // Test 4: Downsampling - No Sampling Needed
  // ========================================================================
  await runner.test('Test 4: Should not downsample when points < maxPoints', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    const testData = generateTestData(50);
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    runner.assertEqual(result.metadata.total_points_in_db, 50, 'Should have 50 points in DB');
    runner.assertEqual(result.metadata.returned_points, 50, 'Should return all 50 points');
    runner.assertEqual(result.metadata.sampling_ratio, 1, 'Sampling ratio should be 1');
  });

  // ========================================================================
  // Test 5: Downsampling - Sampling Required
  // ========================================================================
  await runner.test('Test 5: Should downsample when points > maxPoints', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    const testData = generateTestData(500);
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    runner.assertEqual(result.metadata.total_points_in_db, 500, 'Should have 500 points in DB');
    runner.assertLessThan(result.metadata.returned_points, 120, 'Should return <= 100 points (with margin)');
    runner.assertGreaterThan(result.metadata.sampling_ratio, 1, 'Sampling ratio should be > 1');
  });

  // ========================================================================
  // Test 6: Chronological Order
  // ========================================================================
  await runner.test('Test 6: Should maintain chronological order', async () => {
    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    if (result.features.length > 1) {
      for (let i = 1; i < result.features.length; i++) {
        const prevTime = new Date(result.features[i-1].properties.timestamp);
        const currTime = new Date(result.features[i].properties.timestamp);
        runner.assert(
          currTime >= prevTime,
          `Timestamp at index ${i} should be >= previous timestamp`
        );
      }
    }
  });

  // ========================================================================
  // Test 7: Violation Detection - All Violations
  // ========================================================================
  await runner.test('Test 7: Should detect all violations correctly', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    // Generate data with high temps (all violations)
    const testData = generateTestData(100, { baseTemp: 10.0, tempVariation: 2.0 });
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    const violations = result.features.filter(f => f.properties.is_violation);
    runner.assertEqual(
      violations.length,
      result.features.length,
      'All features should be violations'
    );
    runner.assertGreaterThan(
      result.metadata.violation_count,
      0,
      'Violation count should be > 0'
    );
  });

  // ========================================================================
  // Test 8: Violation Detection - No Violations
  // ========================================================================
  await runner.test('Test 8: Should detect no violations correctly', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    // Generate data with low temps (no violations)
    const testData = generateTestData(100, { baseTemp: 4.0, tempVariation: 2.0 });
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    const violations = result.features.filter(f => f.properties.is_violation);
    runner.assertEqual(violations.length, 0, 'Should have no violations');
    runner.assertEqual(result.metadata.violation_count, 0, 'Violation count should be 0');
  });

  // ========================================================================
  // Test 9: Temperature Statistics
  // ========================================================================
  await runner.test('Test 9: Should calculate temperature statistics', async () => {
    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    if (result.features.length > 0) {
      const stats = result.metadata.temp_statistics;
      runner.assert(stats, 'Should have temp_statistics');
      runner.assert(typeof stats.min === 'number', 'Min should be a number');
      runner.assert(typeof stats.max === 'number', 'Max should be a number');
      runner.assert(stats.min <= stats.max, 'Min should be <= Max');
    }
  });

  // ========================================================================
  // Test 10: Empty Dataset
  // ========================================================================
  await runner.test('Test 10: Should handle empty dataset', async () => {
    const result = await traceRouteAggregation('NON-EXISTENT-SHIPMENT', 8.0, 100);

    runner.assertEqual(result.metadata.total_points_in_db, 0, 'Should have 0 points');
    runner.assertEqual(result.metadata.returned_points, 0, 'Should return 0 points');
    runner.assertEqual(result.features.length, 0, 'Should have empty features array');
  });

  // ========================================================================
  // Test 11: Performance - Small Dataset
  // ========================================================================
  await runner.test('Test 11: Should complete small dataset query quickly', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    const testData = generateTestData(100);
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    runner.assertLessThan(
      result.metadata.execution_time_ms,
      1000,
      'Should complete in < 1 second'
    );
  });

  // ========================================================================
  // Test 12: Coordinate Validation
  // ========================================================================
  await runner.test('Test 12: Should have valid coordinates', async () => {
    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 100);

    result.features.forEach((feature, index) => {
      const [lng, lat] = feature.geometry.coordinates;
      runner.assert(
        lng >= -180 && lng <= 180,
        `Longitude at index ${index} should be in range [-180, 180]`
      );
      runner.assert(
        lat >= -90 && lat <= 90,
        `Latitude at index ${index} should be in range [-90, 90]`
      );
    });
  });

  // ========================================================================
  // Test 13: Violation Severity
  // ========================================================================
  await runner.test('Test 13: Should classify violation severity', async () => {
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': CONFIG.testShipmentId });
    
    const testData = [
      {
        meta: { shipment_id: CONFIG.testShipmentId, device_id: CONFIG.testDeviceId },
        t: new Date('2024-01-15T00:00:00Z'),
        location: { type: 'Point', coordinates: [106.7, 10.8] },
        temp: 9.0,  // WARNING
        humidity: 65
      },
      {
        meta: { shipment_id: CONFIG.testShipmentId, device_id: CONFIG.testDeviceId },
        t: new Date('2024-01-15T01:00:00Z'),
        location: { type: 'Point', coordinates: [106.8, 10.9] },
        temp: 11.0,  // HIGH
        humidity: 66
      },
      {
        meta: { shipment_id: CONFIG.testShipmentId, device_id: CONFIG.testDeviceId },
        t: new Date('2024-01-15T02:00:00Z'),
        location: { type: 'Point', coordinates: [106.9, 11.0] },
        temp: 14.0,  // CRITICAL
        humidity: 67
      }
    ];
    await TelemetryPoints.insertMany(testData);

    const result = await traceRouteAggregation(CONFIG.testShipmentId, 8.0, 10);

    const severities = result.features
      .filter(f => f.properties.is_violation)
      .map(f => f.properties.violation_severity);
    
    runner.assert(
      severities.includes('WARNING') || severities.includes('HIGH') || severities.includes('CRITICAL'),
      'Should have at least one severity level'
    );
  });

  // Cleanup
  console.log('\n[Cleanup] Cleaning test data...');
  await TelemetryPoints.deleteMany({ 
    'meta.shipment_id': { $regex: /^TEST-/ } 
  });
  console.log('[Cleanup] ✓ Cleaned');

  console.log('\n[Cleanup] Disconnecting from MongoDB...');
  await mongoose.disconnect();
  console.log('[Cleanup] ✓ Disconnected');

  // Summary
  const success = runner.summary();
  return success;
}

// ============================================================================
// Main Execution
// ============================================================================
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n✗ Test suite failed with error:', error);
      process.exit(1);
    });
}

module.exports = { runTests, generateTestData };
