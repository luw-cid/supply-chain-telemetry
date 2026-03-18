/**
 * ============================================================================
 * Test Suite: Trace Route Aggregation
 * ============================================================================
 * Description: Comprehensive tests cho MongoDB aggregation pipeline
 * Author: Senior Database Engineer
 * Created: 2026-03-01
 * ============================================================================
 * 
 * USAGE:
 * npm test -- test_trace_route_aggregation.js
 * hoặc
 * node src/database/test/test_trace_route_aggregation.js
 * ============================================================================
 */

const mongoose = require('mongoose');
const { expect } = require('chai');
const {
  describe,
  it,
  before,
  after,
  beforeEach
} = require('mocha');
const TelemetryPoints = require('../../models/mongodb/telemetry_points');
const { 
  traceRouteAggregation, 
  traceRouteFullData 
} = require('../mongo/trace_route_aggregation');

// ============================================================================
// Test Configuration
// ============================================================================
const TEST_CONFIG = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/supply_chain_test',
  testShipmentId: 'TEST-SHP-001',
  testDeviceId: 'TEST-DEV-001',
  tempThreshold: 8.0,
  maxPoints: 100
};

// ============================================================================
// Test Data Generator
// ============================================================================
class TestDataGenerator {
  /**
   * Generate test telemetry points
   * @param {Object} options - Generation options
   * @returns {Array} Array of telemetry point documents
   */
  static generateTelemetryPoints(options = {}) {
    const {
      shipmentId = TEST_CONFIG.testShipmentId,
      deviceId = TEST_CONFIG.testDeviceId,
      count = 500,
      startTime = new Date('2024-01-15T00:00:00Z'),
      intervalMinutes = 5,
      baseTemp = 6.0,
      tempVariation = 4.0,
      violationRate = 0.2,  // 20% violations
      route = [
        { lng: 106.7, lat: 10.8 },  // Ho Chi Minh
        { lng: 103.8, lat: 1.3 },   // Singapore
        { lng: -74.0, lat: 40.7 }   // New York
      ]
    } = options;

    const points = [];
    const hasRouteSegment = Array.isArray(route) && route.length > 1;
    const routeSegmentSize = hasRouteSegment
      ? Math.max(1, Math.floor(count / (route.length - 1)))
      : 1;

    for (let i = 0; i < count; i++) {
      let lng;
      let lat;

      if (hasRouteSegment) {
        // Keep route interpolation stable for tiny datasets (e.g. count = 1).
        const segmentIndex = Math.min(
          Math.floor(i / routeSegmentSize),
          route.length - 2
        );
        const segmentProgress = (i % routeSegmentSize) / routeSegmentSize;

        const startPoint = route[segmentIndex];
        const endPoint = route[segmentIndex + 1];

        lng = startPoint.lng + (endPoint.lng - startPoint.lng) * segmentProgress;
        lat = startPoint.lat + (endPoint.lat - startPoint.lat) * segmentProgress;
      } else {
        const fallbackPoint = route[0] || { lng: 0, lat: 0 };
        lng = fallbackPoint.lng;
        lat = fallbackPoint.lat;
      }

      // Calculate temperature with some violations
      let temp = baseTemp + (Math.random() * tempVariation);
      
      // Introduce violations at specific rate
      if (Math.random() < violationRate) {
        temp = TEST_CONFIG.tempThreshold + (Math.random() * 5); // 8-13°C
      }

      // Calculate timestamp
      const timestamp = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);

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

  /**
   * Generate edge case scenarios
   */
  static generateEdgeCases() {
    return {
      // Empty dataset
      empty: [],

      // Single point
      single: this.generateTelemetryPoints({ count: 1 }),

      // Small dataset (no downsampling needed)
      small: this.generateTelemetryPoints({ count: 50 }),

      // Large dataset (requires downsampling)
      large: this.generateTelemetryPoints({ count: 5000 }),

      // All violations
      allViolations: this.generateTelemetryPoints({
        count: 100,
        baseTemp: 10.0,
        tempVariation: 5.0,
        violationRate: 1.0
      }),

      // No violations
      noViolations: this.generateTelemetryPoints({
        count: 100,
        baseTemp: 4.0,
        tempVariation: 2.0,
        violationRate: 0.0
      }),

      // Extreme temperatures
      extremeTemps: this.generateTelemetryPoints({
        count: 100,
        baseTemp: -20.0,
        tempVariation: 60.0
      })
    };
  }
}

// ============================================================================
// Test Suite
// ============================================================================
describe('Trace Route Aggregation Tests', function() {
  this.timeout(30000); // 30 second timeout for large datasets

  // Setup: Connect to MongoDB
  before(async function() {
    console.log('\n[Setup] Connecting to MongoDB...');
    await mongoose.connect(TEST_CONFIG.mongoUri);
    console.log('[Setup] ✓ Connected to MongoDB');
  });

  // Cleanup: Disconnect from MongoDB
  after(async function() {
    console.log('\n[Cleanup] Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('[Cleanup] ✓ Disconnected from MongoDB');
  });

  // Before each test: Clear test data
  beforeEach(async function() {
    await TelemetryPoints.deleteMany({ 
      'meta.shipment_id': { $regex: /^TEST-/ } 
    });
  });

  // ========================================================================
  // Test Group 1: Basic Functionality
  // ========================================================================
  describe('1. Basic Functionality', function() {
    
    it('1.1 Should return GeoJSON FeatureCollection format', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result).to.have.property('type', 'FeatureCollection');
      expect(result).to.have.property('metadata');
      expect(result).to.have.property('features');
      expect(result.features).to.be.an('array');
    });

    it('1.2 Should return correct metadata structure', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result.metadata).to.include.all.keys(
        'shipment_id',
        'total_points_in_db',
        'returned_points',
        'sampling_ratio',
        'temp_threshold',
        'violation_count',
        'violation_rate',
        'temp_statistics',
        'execution_time_ms',
        'generated_at'
      );
    });

    it('1.3 Should return features with correct GeoJSON structure', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const feature = result.features[0];
      expect(feature).to.have.property('type', 'Feature');
      expect(feature).to.have.property('geometry');
      expect(feature.geometry).to.have.property('type', 'Point');
      expect(feature.geometry).to.have.property('coordinates');
      expect(feature.geometry.coordinates).to.be.an('array').with.lengthOf(2);
      expect(feature).to.have.property('properties');
    });

    it('1.4 Should include required properties in features', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const properties = result.features[0].properties;
      expect(properties).to.include.all.keys(
        'timestamp',
        'temp',
        'humidity',
        'device_id',
        'is_violation',
        'temp_delta'
      );
    });
  });

  // ========================================================================
  // Test Group 2: Downsampling Logic
  // ========================================================================
  describe('2. Downsampling Logic', function() {
    
    it('2.1 Should not downsample when points < maxPoints', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 50 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        100  // maxPoints > actual points
      );

      // Assert
      expect(result.metadata.total_points_in_db).to.equal(50);
      expect(result.metadata.returned_points).to.equal(50);
      expect(result.metadata.sampling_ratio).to.equal(1);
    });

    it('2.2 Should downsample when points > maxPoints', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 500 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        100  // maxPoints < actual points
      );

      // Assert
      expect(result.metadata.total_points_in_db).to.equal(500);
      expect(result.metadata.returned_points).to.be.at.most(100);
      expect(result.metadata.sampling_ratio).to.be.greaterThan(1);
    });

    it('2.3 Should calculate correct sampling ratio', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 1000 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        200  // Expected ratio: 1000/200 = 5
      );

      // Assert
      expect(result.metadata.sampling_ratio).to.equal(5);
      expect(result.metadata.returned_points).to.be.closeTo(200, 10);
    });

    it('2.4 Should maintain chronological order after downsampling', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 500 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        100
      );

      // Assert
      const timestamps = result.features.map(f => new Date(f.properties.timestamp));
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i].getTime()).to.be.at.least(timestamps[i-1].getTime());
      }
    });
  });

  // ========================================================================
  // Test Group 3: Violation Detection
  // ========================================================================
  describe('3. Violation Detection', function() {
    
    it('3.1 Should correctly identify violations', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({
        count: 100,
        baseTemp: 10.0,  // Above threshold
        tempVariation: 1.0,
        violationRate: 1.0  // All violations
      });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const violations = result.features.filter(f => f.properties.is_violation);
      expect(violations.length).to.equal(result.features.length);
      expect(result.metadata.violation_count).to.equal(result.features.length);
    });

    it('3.2 Should correctly identify non-violations', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({
        count: 100,
        baseTemp: 4.0,  // Below threshold
        tempVariation: 2.0,
        violationRate: 0.0  // No violations
      });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const violations = result.features.filter(f => f.properties.is_violation);
      expect(violations.length).to.equal(0);
      expect(result.metadata.violation_count).to.equal(0);
    });

    it('3.3 Should calculate correct violation rate', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({
        count: 100,
        violationRate: 0.25  // 25% violations
      });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const expectedRate = (result.metadata.violation_count / result.metadata.returned_points) * 100;
      expect(result.metadata.violation_rate).to.equal(`${expectedRate.toFixed(2)}%`);
    });

    it('3.4 Should classify violation severity correctly', async function() {
      // Arrange
      const testData = [
        // WARNING: temp > threshold, delta < 2
        { 
          meta: { shipment_id: TEST_CONFIG.testShipmentId, device_id: TEST_CONFIG.testDeviceId },
          t: new Date('2024-01-15T00:00:00Z'),
          location: { type: 'Point', coordinates: [106.7, 10.8] },
          temp: 9.0,  // +1°C above threshold
          humidity: 65
        },
        // HIGH: temp > threshold, delta >= 2, delta < 5
        {
          meta: { shipment_id: TEST_CONFIG.testShipmentId, device_id: TEST_CONFIG.testDeviceId },
          t: new Date('2024-01-15T01:00:00Z'),
          location: { type: 'Point', coordinates: [106.8, 10.9] },
          temp: 11.0,  // +3°C above threshold
          humidity: 66
        },
        // CRITICAL: temp > threshold, delta >= 5
        {
          meta: { shipment_id: TEST_CONFIG.testShipmentId, device_id: TEST_CONFIG.testDeviceId },
          t: new Date('2024-01-15T02:00:00Z'),
          location: { type: 'Point', coordinates: [106.9, 11.0] },
          temp: 14.0,  // +6°C above threshold
          humidity: 67
        }
      ];
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        10
      );

      // Assert
      const severities = result.features.map(f => f.properties.violation_severity);
      expect(severities).to.include('WARNING');
      expect(severities).to.include('HIGH');
      expect(severities).to.include('CRITICAL');
    });

    it('3.5 Should calculate temp_delta correctly', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      result.features.forEach(feature => {
        const expectedDelta = feature.properties.temp - TEST_CONFIG.tempThreshold;
        expect(feature.properties.temp_delta).to.be.closeTo(expectedDelta, 0.01);
      });
    });
  });

  // ========================================================================
  // Test Group 4: Statistics Calculation
  // ========================================================================
  describe('4. Statistics Calculation', function() {
    
    it('4.1 Should calculate temperature statistics correctly', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      const stats = result.metadata.temp_statistics;
      expect(stats).to.have.all.keys('min', 'max', 'avg');
      expect(stats.min).to.be.a('number');
      expect(stats.max).to.be.a('number');
      expect(stats.avg).to.be.a('string');
      expect(stats.min).to.be.at.most(stats.max);
    });

    it('4.2 Should calculate data reduction percentage', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 1000 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        200
      );

      // Assert
      const expectedReduction = (1 - result.metadata.returned_points / 1000) * 100;
      expect(parseFloat(result.metadata.data_reduction_pct)).to.be.closeTo(expectedReduction, 1);
    });

    it('4.3 Should track execution time', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result.metadata.execution_time_ms).to.be.a('number');
      expect(result.metadata.execution_time_ms).to.be.greaterThan(0);
    });
  });

  // ========================================================================
  // Test Group 5: Edge Cases
  // ========================================================================
  describe('5. Edge Cases', function() {
    
    it('5.1 Should handle empty dataset', async function() {
      // Act
      const result = await traceRouteAggregation(
        'NON-EXISTENT-SHIPMENT',
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result.metadata.total_points_in_db).to.equal(0);
      expect(result.metadata.returned_points).to.equal(0);
      expect(result.features).to.be.an('array').with.lengthOf(0);
    });

    it('5.2 Should handle single data point', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 1 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result.metadata.total_points_in_db).to.equal(1);
      expect(result.metadata.returned_points).to.equal(1);
      expect(result.features).to.have.lengthOf(1);
    });

    it('5.3 Should handle very large dataset', async function() {
      this.timeout(60000); // 60 second timeout

      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 10000 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const startTime = Date.now();
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        1000
      );
      const executionTime = Date.now() - startTime;

      // Assert
      expect(result.metadata.total_points_in_db).to.equal(10000);
      expect(result.metadata.returned_points).to.be.at.most(1000);
      expect(executionTime).to.be.lessThan(5000); // Should complete in < 5 seconds
    });

    it('5.4 Should handle extreme temperature values', async function() {
      // Arrange
      const testData = [
        {
          meta: { shipment_id: TEST_CONFIG.testShipmentId, device_id: TEST_CONFIG.testDeviceId },
          t: new Date(),
          location: { type: 'Point', coordinates: [0, 0] },
          temp: -50.0,  // Extreme cold
          humidity: 50
        },
        {
          meta: { shipment_id: TEST_CONFIG.testShipmentId, device_id: TEST_CONFIG.testDeviceId },
          t: new Date(),
          location: { type: 'Point', coordinates: [0, 0] },
          temp: 80.0,  // Extreme heat
          humidity: 50
        }
      ];
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        10
      );

      // Assert
      expect(result.features).to.have.lengthOf(2);
      expect(result.metadata.temp_statistics.min).to.equal(-50.0);
      expect(result.metadata.temp_statistics.max).to.equal(80.0);
    });

    it('5.5 Should handle different threshold values', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({
        count: 100,
        baseTemp: 5.0,
        tempVariation: 10.0
      });
      await TelemetryPoints.insertMany(testData);

      // Act - Test with different thresholds
      const result1 = await traceRouteAggregation(TEST_CONFIG.testShipmentId, 0.0, 100);
      const result2 = await traceRouteAggregation(TEST_CONFIG.testShipmentId, 10.0, 100);
      const result3 = await traceRouteAggregation(TEST_CONFIG.testShipmentId, 20.0, 100);

      // Assert
      expect(result1.metadata.violation_count).to.be.greaterThan(result2.metadata.violation_count);
      expect(result2.metadata.violation_count).to.be.greaterThan(result3.metadata.violation_count);
    });
  });

  // ========================================================================
  // Test Group 6: Performance Tests
  // ========================================================================
  describe('6. Performance Tests', function() {
    
    it('6.1 Should complete small dataset query in < 100ms', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      expect(result.metadata.execution_time_ms).to.be.lessThan(100);
    });

    it('6.2 Should complete medium dataset query in < 500ms', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 1000 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        200
      );

      // Assert
      expect(result.metadata.execution_time_ms).to.be.lessThan(500);
    });

    it('6.3 Should have consistent performance across multiple runs', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 500 });
      await TelemetryPoints.insertMany(testData);

      // Act - Run 5 times
      const executionTimes = [];
      for (let i = 0; i < 5; i++) {
        const result = await traceRouteAggregation(
          TEST_CONFIG.testShipmentId,
          TEST_CONFIG.tempThreshold,
          100
        );
        executionTimes.push(result.metadata.execution_time_ms);
      }

      // Assert - Standard deviation should be low
      const avg = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / executionTimes.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).to.be.lessThan(avg * 0.3); // Std dev < 30% of average
    });
  });

  // ========================================================================
  // Test Group 7: Data Quality
  // ========================================================================
  describe('7. Data Quality', function() {
    
    it('7.1 Should round temperature values to 2 decimals', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      result.features.forEach(feature => {
        const temp = feature.properties.temp;
        const decimals = (temp.toString().split('.')[1] || '').length;
        expect(decimals).to.be.at.most(2);
      });
    });

    it('7.2 Should include valid coordinates', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      result.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        expect(lng).to.be.within(-180, 180);
        expect(lat).to.be.within(-90, 90);
      });
    });

    it('7.3 Should include valid timestamps', async function() {
      // Arrange
      const testData = TestDataGenerator.generateTelemetryPoints({ count: 100 });
      await TelemetryPoints.insertMany(testData);

      // Act
      const result = await traceRouteAggregation(
        TEST_CONFIG.testShipmentId,
        TEST_CONFIG.tempThreshold,
        TEST_CONFIG.maxPoints
      );

      // Assert
      result.features.forEach(feature => {
        const timestamp = new Date(feature.properties.timestamp);
        expect(timestamp.toString()).to.not.equal('Invalid Date');
      });
    });
  });
});

// ============================================================================
// CLI Execution (for manual testing)
// ============================================================================
if (require.main === module) {
  console.log('Running Trace Route Aggregation Tests...\n');
  
  // Run with Mocha
  const Mocha = require('mocha');
  const mocha = new Mocha({
    reporter: 'spec',
    timeout: 30000
  });

  mocha.addFile(__filename);
  
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}

module.exports = {
  TestDataGenerator
};
