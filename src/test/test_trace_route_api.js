/**
 * ============================================================================
 * TEST: Trace Route API
 * ============================================================================
 * Purpose: Test endpoint GET /api/v1/analytics/trace-route/:shipmentId
 * Method: Manual testing với sample data
 * 
 * PREREQUISITES:
 * ============================================================================
 * 1. MongoDB phải có telemetry_points data
 * 2. MySQL phải có Shipments và CargoProfiles data
 * 3. Server đang chạy trên port 3000
 * 
 * TEST SCENARIOS:
 * ============================================================================
 * 1. Happy Path: Shipment có telemetry data
 * 2. Edge Case: Shipment không có telemetry data
 * 3. Error Case: Shipment không tồn tại
 * 4. Parameter Test: maxPoints parameter
 * 5. Performance Test: Large dataset với downsampling
 * ============================================================================
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

/**
 * Test Helper: Make API request
 */
async function testTraceRoute(shipmentId, maxPoints = null) {
  try {
    const url = `${BASE_URL}/api/v1/analytics/trace-route/${shipmentId}`;
    const params = maxPoints ? { maxPoints } : {};
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST: Trace Route for Shipment ${shipmentId}`);
    console.log(`URL: ${url}`);
    console.log(`Params:`, params);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    const response = await axios.get(url, { params });
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ SUCCESS (${duration}ms)`);
    console.log(`Status: ${response.status}`);
    console.log(`\nResponse Structure:`);
    console.log(`- success: ${response.data.success}`);
    console.log(`- data.type: ${response.data.data.type}`);
    console.log(`- data.features.length: ${response.data.data.features.length}`);
    
    console.log(`\nMetadata:`);
    const metadata = response.data.data.metadata;
    console.log(`- shipment_id: ${metadata.shipment_id}`);
    console.log(`- total_points_in_db: ${metadata.total_points_in_db}`);
    console.log(`- returned_points: ${metadata.returned_points}`);
    console.log(`- sampling_ratio: ${metadata.sampling_ratio}`);
    console.log(`- data_reduction_pct: ${metadata.data_reduction_pct}%`);
    console.log(`- temp_threshold: ${metadata.temp_threshold}°C`);
    console.log(`- violation_count: ${metadata.violation_count}`);
    console.log(`- violation_rate: ${metadata.violation_rate}`);
    console.log(`- execution_time_ms: ${metadata.execution_time_ms}ms`);
    
    if (metadata.temp_statistics) {
      console.log(`\nTemperature Statistics:`);
      console.log(`- min: ${metadata.temp_statistics.min}°C`);
      console.log(`- max: ${metadata.temp_statistics.max}°C`);
      console.log(`- avg: ${metadata.temp_statistics.avg}°C`);
    }
    
    if (metadata.route_statistics) {
      console.log(`\nRoute Statistics:`);
      console.log(`- total_distance_km: ${metadata.route_statistics.total_distance_km} km`);
      console.log(`- duration_hours: ${metadata.route_statistics.duration_hours} hours`);
      console.log(`- avg_speed_kmh: ${metadata.route_statistics.avg_speed_kmh} km/h`);
      console.log(`- start_time: ${metadata.route_statistics.start_time}`);
      console.log(`- end_time: ${metadata.route_statistics.end_time}`);
    }
    
    if (metadata.shipment_details) {
      console.log(`\nShipment Details:`);
      console.log(`- origin_port: ${metadata.shipment_details.origin_port}`);
      console.log(`- destination_port: ${metadata.shipment_details.destination_port}`);
      console.log(`- current_status: ${metadata.shipment_details.current_status}`);
      console.log(`- current_location: ${metadata.shipment_details.current_location}`);
    }
    
    // Sample first feature
    if (response.data.data.features.length > 0) {
      console.log(`\nSample Feature (first point):`);
      const feature = response.data.data.features[0];
      console.log(JSON.stringify(feature, null, 2));
    }
    
    return response.data;
    
  } catch (error) {
    console.log(`\n❌ ERROR`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error:`, error.response.data);
    } else {
      console.log(`Error:`, error.message);
    }
    throw error;
  }
}

/**
 * Test Suite
 */
async function runTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'TRACE ROUTE API TEST SUITE' + ' '.repeat(32) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  try {
    // ========================================================================
    // TEST 1: Happy Path - Shipment có data
    // ========================================================================
    console.log('\n\n📋 TEST 1: Happy Path - Valid Shipment with Telemetry Data');
    await testTraceRoute('SH001');
    
    // ========================================================================
    // TEST 2: Parameter Test - maxPoints
    // ========================================================================
    console.log('\n\n📋 TEST 2: Parameter Test - maxPoints = 100');
    await testTraceRoute('SH001', 100);
    
    // ========================================================================
    // TEST 3: Parameter Test - maxPoints = 500
    // ========================================================================
    console.log('\n\n📋 TEST 3: Parameter Test - maxPoints = 500');
    await testTraceRoute('SH001', 500);
    
    // ========================================================================
    // TEST 4: Error Case - Shipment không tồn tại
    // ========================================================================
    console.log('\n\n📋 TEST 4: Error Case - Non-existent Shipment');
    try {
      await testTraceRoute('INVALID_SHIPMENT_ID');
    } catch (error) {
      console.log('✅ Expected error handled correctly');
    }
    
    // ========================================================================
    // TEST 5: Edge Case - Empty shipmentId
    // ========================================================================
    console.log('\n\n📋 TEST 5: Edge Case - Empty shipmentId');
    try {
      await testTraceRoute('');
    } catch (error) {
      console.log('✅ Expected error handled correctly');
    }
    
    // ========================================================================
    // TEST 6: Parameter Validation - Invalid maxPoints
    // ========================================================================
    console.log('\n\n📋 TEST 6: Parameter Validation - Invalid maxPoints');
    try {
      await testTraceRoute('SH001', 99999);
    } catch (error) {
      console.log('✅ Expected error handled correctly');
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.log('\n\n' + '='.repeat(80));
    console.log('❌ TEST SUITE FAILED');
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

/**
 * Performance Test: Measure response time với different maxPoints
 */
async function performanceTest() {
  console.log('\n\n╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(25) + 'PERFORMANCE TEST' + ' '.repeat(37) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');
  
  const testCases = [
    { maxPoints: 100, label: 'Small (100 points)' },
    { maxPoints: 500, label: 'Medium (500 points)' },
    { maxPoints: 1000, label: 'Large (1000 points)' },
    { maxPoints: 2000, label: 'XLarge (2000 points)' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const startTime = Date.now();
      const response = await axios.get(
        `${BASE_URL}/api/v1/analytics/trace-route/SH001`,
        { params: { maxPoints: testCase.maxPoints } }
      );
      const duration = Date.now() - startTime;
      
      results.push({
        label: testCase.label,
        maxPoints: testCase.maxPoints,
        duration: duration,
        returnedPoints: response.data.data.features.length,
        executionTime: response.data.data.metadata.execution_time_ms
      });
      
      console.log(`✅ ${testCase.label}: ${duration}ms (DB: ${response.data.data.metadata.execution_time_ms}ms)`);
      
    } catch (error) {
      console.log(`❌ ${testCase.label}: FAILED`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE SUMMARY:');
  console.log('='.repeat(80));
  console.log('Label'.padEnd(25) + 'Total Time'.padEnd(15) + 'DB Time'.padEnd(15) + 'Points');
  console.log('-'.repeat(80));
  
  results.forEach(r => {
    console.log(
      r.label.padEnd(25) +
      `${r.duration}ms`.padEnd(15) +
      `${r.executionTime}ms`.padEnd(15) +
      r.returnedPoints
    );
  });
  
  console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance')) {
    performanceTest().catch(console.error);
  } else if (args.includes('--shipment')) {
    const shipmentId = args[args.indexOf('--shipment') + 1];
    const maxPoints = args.includes('--maxPoints') 
      ? parseInt(args[args.indexOf('--maxPoints') + 1], 10)
      : null;
    testTraceRoute(shipmentId, maxPoints).catch(console.error);
  } else {
    runTests().catch(console.error);
  }
}

module.exports = {
  testTraceRoute,
  performanceTest
};
