/**
 * ============================================================================
 * SEED TELEMETRY DATA FOR TRACE ROUTE API TESTING
 * ============================================================================
 * Purpose: Tạo telemetry points data trong MongoDB cho testing
 * Collection: telemetry_points (time-series)
 * Author: Senior Database Engineer
 * Created: 2026-03-21
 * 
 * USAGE:
 * ============================================================================
 * node src/database/test/seed_trace_route_telemetry.js
 * 
 * OPTIONS:
 * - --shipment <id>: Seed data cho shipment cụ thể
 * - --points <n>: Số lượng points mỗi shipment (default: 100)
 * - --clean: Xóa data cũ trước khi seed
 * 
 * EXAMPLES:
 * node src/database/test/seed_trace_route_telemetry.js --clean
 * node src/database/test/seed_trace_route_telemetry.js --shipment SH001 --points 500
 * ============================================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const TelemetryPoints = require('../../models/mongodb/telemetry_points');

// ============================================================================
// CONFIGURATION
// ============================================================================
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/supply_chain_db';

// Route definitions: [lng, lat] coordinates
const ROUTES = {
  SH001: {
    // Singapore → Hong Kong → Yokohama → New York
    // Vaccine shipment với violations
    shipment_id: 'SH001',
    device_id: 'IOT-DEVICE-001',
    temp_threshold: 8,  // Vaccine: max 8°C
    route: [
      { port: 'SGSIN', coords: [103.8198, 1.3521], name: 'Singapore' },
      { port: 'HKHKG', coords: [114.1694, 22.3193], name: 'Hong Kong' },
      { port: 'JPYOK', coords: [139.6380, 35.4437], name: 'Yokohama' },
      { port: 'USNYC', coords: [-74.0060, 40.7128], name: 'New York' }
    ],
    duration_hours: 48,
    violation_probability: 0.15  // 15% chance of violation
  },
  
  SH002: {
    // Hong Kong → Yokohama → Los Angeles
    // Pharmaceutical shipment, no violations
    shipment_id: 'SH002',
    device_id: 'IOT-DEVICE-002',
    temp_threshold: 25,  // Pharmaceutical: max 25°C
    route: [
      { port: 'HKHKG', coords: [114.1694, 22.3193], name: 'Hong Kong' },
      { port: 'JPYOK', coords: [139.6380, 35.4437], name: 'Yokohama' },
      { port: 'USLAX', coords: [-118.2713, 33.7405], name: 'Los Angeles' }
    ],
    duration_hours: 72,
    violation_probability: 0.05  // 5% chance of violation
  },
  
  SH003: {
    // Singapore → Hong Kong (short route, completed)
    // Medical Equipment, relaxed control
    shipment_id: 'SH003',
    device_id: 'IOT-DEVICE-003',
    temp_threshold: 35,  // Medical Equipment: max 35°C
    route: [
      { port: 'SGSIN', coords: [103.8198, 1.3521], name: 'Singapore' },
      { port: 'HKHKG', coords: [114.1694, 22.3193], name: 'Hong Kong' }
    ],
    duration_hours: 24,
    violation_probability: 0.02  // 2% chance of violation
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Interpolate coordinates between two points
 */
function interpolateCoordinates(start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lng = start[0] + (end[0] - start[0]) * ratio;
    const lat = start[1] + (end[1] - start[1]) * ratio;
    points.push([lng, lat]);
  }
  return points;
}

/**
 * Generate realistic temperature with optional violations
 */
function generateTemperature(baseTemp, threshold, violationProb) {
  const random = Math.random();
  
  if (random < violationProb) {
    // Generate violation: threshold + 0 to 10°C
    const violation = Math.random() * 10;
    return parseFloat((threshold + violation).toFixed(2));
  } else {
    // Normal temperature: baseTemp ± 2°C, but below threshold
    const variation = (Math.random() - 0.5) * 4;
    const temp = baseTemp + variation;
    return parseFloat(Math.min(temp, threshold - 0.5).toFixed(2));
  }
}

/**
 * Generate realistic humidity
 */
function generateHumidity(baseHumidity = 60) {
  const variation = (Math.random() - 0.5) * 20;
  const humidity = baseHumidity + variation;
  return parseFloat(Math.max(30, Math.min(90, humidity)).toFixed(2));
}

/**
 * Generate telemetry points for a shipment
 */
async function generateTelemetryPoints(routeConfig, numPoints = 100) {
  const { shipment_id, device_id, route, duration_hours, temp_threshold, violation_probability } = routeConfig;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Generating telemetry for ${shipment_id}`);
  console.log(`Route: ${route.map(r => r.name).join(' → ')}`);
  console.log(`Points: ${numPoints}, Duration: ${duration_hours}h, Threshold: ${temp_threshold}°C`);
  console.log('='.repeat(80));
  
  const telemetryPoints = [];
  const startTime = new Date(Date.now() - duration_hours * 60 * 60 * 1000);
  const timeInterval = (duration_hours * 60 * 60 * 1000) / numPoints;
  
  // Generate interpolated coordinates for entire route
  const allCoordinates = [];
  const pointsPerSegment = Math.floor(numPoints / (route.length - 1));
  
  for (let i = 0; i < route.length - 1; i++) {
    const segmentCoords = interpolateCoordinates(
      route[i].coords,
      route[i + 1].coords,
      pointsPerSegment
    );
    allCoordinates.push(...segmentCoords);
  }
  
  // Ensure we have exactly numPoints
  while (allCoordinates.length < numPoints) {
    allCoordinates.push(route[route.length - 1].coords);
  }
  allCoordinates.length = numPoints;
  
  // Base temperature depends on cargo type
  let baseTemp;
  if (temp_threshold <= 8) {
    baseTemp = 5;  // Vaccine
  } else if (temp_threshold <= 25) {
    baseTemp = 20;  // Pharmaceutical
  } else {
    baseTemp = 25;  // Medical Equipment
  }
  
  // Generate telemetry points
  let violationCount = 0;
  
  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(startTime.getTime() + i * timeInterval);
    const coords = allCoordinates[i];
    const temp = generateTemperature(baseTemp, temp_threshold, violation_probability);
    const humidity = generateHumidity();
    
    if (temp > temp_threshold) {
      violationCount++;
    }
    
    telemetryPoints.push({
      meta: {
        shipment_id: shipment_id,
        device_id: device_id
      },
      t: timestamp,
      location: {
        type: 'Point',
        coordinates: coords
      },
      temp: temp,
      humidity: humidity
    });
  }
  
  console.log(`Generated ${numPoints} points with ${violationCount} violations (${(violationCount/numPoints*100).toFixed(2)}%)`);
  
  return telemetryPoints;
}

/**
 * Seed data for all shipments
 */
async function seedAllShipments(numPoints = 100, clean = false) {
  try {
    console.log('\n╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + 'SEED TELEMETRY DATA FOR TRACE ROUTE' + ' '.repeat(23) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    
    // Connect to MongoDB
    console.log(`\nConnecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clean existing data if requested
    if (clean) {
      console.log('\n🧹 Cleaning existing telemetry data...');
      const shipmentIds = Object.keys(ROUTES);
      const result = await TelemetryPoints.deleteMany({
        'meta.shipment_id': { $in: shipmentIds }
      });
      console.log(`✅ Deleted ${result.deletedCount} existing records`);
    }
    
    // Generate and insert data for each shipment
    for (const [shipmentId, routeConfig] of Object.entries(ROUTES)) {
      const points = await generateTelemetryPoints(routeConfig, numPoints);
      
      console.log(`Inserting ${points.length} points into MongoDB...`);
      const startTime = Date.now();
      
      // Batch insert for better performance
      const batchSize = 1000;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await TelemetryPoints.insertMany(batch, { ordered: false });
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Inserted in ${duration}ms (${(points.length / duration * 1000).toFixed(0)} points/sec)`);
      
      // Verify insertion
      const count = await TelemetryPoints.countDocuments({
        'meta.shipment_id': shipmentId
      });
      console.log(`✅ Verified: ${count} points in database for ${shipmentId}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    for (const shipmentId of Object.keys(ROUTES)) {
      const count = await TelemetryPoints.countDocuments({
        'meta.shipment_id': shipmentId
      });
      
      const sample = await TelemetryPoints.findOne({
        'meta.shipment_id': shipmentId
      }).sort({ t: 1 });
      
      const latest = await TelemetryPoints.findOne({
        'meta.shipment_id': shipmentId
      }).sort({ t: -1 });
      
      console.log(`\n${shipmentId}:`);
      console.log(`  - Total points: ${count}`);
      console.log(`  - First timestamp: ${sample?.t.toISOString()}`);
      console.log(`  - Last timestamp: ${latest?.t.toISOString()}`);
      console.log(`  - Temperature range: ${sample?.temp}°C - ${latest?.temp}°C`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SEED COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nYou can now test the API with:');
    console.log('  curl http://localhost:3000/api/v1/analytics/trace-route/SH001');
    console.log('  node src/test/test_trace_route_api.js\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB\n');
  }
}

/**
 * Seed data for specific shipment
 */
async function seedShipment(shipmentId, numPoints = 100, clean = false) {
  try {
    const routeConfig = ROUTES[shipmentId];
    
    if (!routeConfig) {
      throw new Error(`Unknown shipment: ${shipmentId}. Available: ${Object.keys(ROUTES).join(', ')}`);
    }
    
    console.log(`\nSeeding data for ${shipmentId}...`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    if (clean) {
      console.log(`\n🧹 Cleaning existing data for ${shipmentId}...`);
      const result = await TelemetryPoints.deleteMany({
        'meta.shipment_id': shipmentId
      });
      console.log(`✅ Deleted ${result.deletedCount} records`);
    }
    
    const points = await generateTelemetryPoints(routeConfig, numPoints);
    
    console.log(`Inserting ${points.length} points...`);
    await TelemetryPoints.insertMany(points);
    
    const count = await TelemetryPoints.countDocuments({
      'meta.shipment_id': shipmentId
    });
    
    console.log(`✅ Success! ${count} points inserted for ${shipmentId}\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const shipmentArg = args.includes('--shipment') 
    ? args[args.indexOf('--shipment') + 1] 
    : null;
  
  const pointsArg = args.includes('--points') 
    ? parseInt(args[args.indexOf('--points') + 1], 10) 
    : 100;
  
  const cleanArg = args.includes('--clean');
  
  if (shipmentArg) {
    seedShipment(shipmentArg, pointsArg, cleanArg)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    seedAllShipments(pointsArg, cleanArg)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = {
  seedAllShipments,
  seedShipment,
  ROUTES
};
