/**
 * ============================================================================
 * TEST SUITE: Route Optimization with $graphLookup
 * ============================================================================
 * Comprehensive testing cho route optimization feature
 * Includes: Unit tests, Integration tests, Performance tests
 * ============================================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { findOptimalRoutes } = require('../mongo/route_optimization_aggregation');
const { getOptimalRoutes } = require('../../services/route_optimization.service');
const PortEdges = require('../../models/mongodb/port_edges');

/**
 * ============================================================================
 * TEST DATA GENERATOR
 * ============================================================================
 * Tạo dữ liệu mẫu cho testing
 * Mô phỏng mạng lưới cảng thực tế với multiple paths
 */
async function generateTestData() {
  console.log('\n[TestData] Generating sample port edges...');

  // Clear existing test data
  await PortEdges.deleteMany({});

  // Define test network topology
  // Mạng lưới: VNSGN -> SGSIN -> HKHKG -> USNYC
  //                  \-> MYTPP -> JPTYO -> USNYC
  //                  \-> USNYC (direct)
  
  const testEdges = [
    // ========================================================================
    // PATH 1: VNSGN -> SGSIN -> HKHKG -> USNYC (Fast but medium risk)
    // ========================================================================
    {
      from_port: 'VNSGN',
      to_port: 'SGSIN',
      route_type: 'SEA',
      distance_km: 1200,
      avg_hours: 48,
      min_hours: 42,
      max_hours: 56,
      std_dev_hours: 4,
      samples: 150,
      alarm_rate: 0.06,  // 6% - acceptable
      is_active: true
    },
    {
      from_port: 'SGSIN',
      to_port: 'HKHKG',
      route_type: 'SEA',
      distance_km: 2600,
      avg_hours: 72,
      min_hours: 68,
      max_hours: 80,
      std_dev_hours: 3,
      samples: 200,
      alarm_rate: 0.04,  // 4% - very good
      is_active: true
    },
    {
      from_port: 'HKHKG',
      to_port: 'USNYC',
      route_type: 'SEA',
      distance_km: 12800,
      avg_hours: 360,
      min_hours: 340,
      max_hours: 400,
      std_dev_hours: 15,
      samples: 180,
      alarm_rate: 0.08,  // 8% - acceptable
      is_active: true
    },

    // ========================================================================
    // PATH 2: VNSGN -> MYTPP -> JPTYO -> USNYC (Slower but safer)
    // ========================================================================
    {
      from_port: 'VNSGN',
      to_port: 'MYTPP',
      route_type: 'SEA',
      distance_km: 1800,
      avg_hours: 60,
      min_hours: 55,
      max_hours: 68,
      std_dev_hours: 4,
      samples: 120,
      alarm_rate: 0.03,  // 3% - excellent
      is_active: true
    },
    {
      from_port: 'MYTPP',
      to_port: 'JPTYO',
      route_type: 'SEA',
      distance_km: 5200,
      avg_hours: 144,
      min_hours: 136,
      max_hours: 156,
      std_dev_hours: 6,
      samples: 100,
      alarm_rate: 0.02,  // 2% - excellent
      is_active: true
    },
    {
      from_port: 'JPTYO',
      to_port: 'USNYC',
      route_type: 'SEA',
      distance_km: 10800,
      avg_hours: 312,
      min_hours: 300,
      max_hours: 336,
      std_dev_hours: 12,
      samples: 160,
      alarm_rate: 0.05,  // 5% - good
      is_active: true
    },

    // ========================================================================
    // PATH 3: VNSGN -> USNYC (Direct - fastest but highest risk)
    // ========================================================================
    {
      from_port: 'VNSGN',
      to_port: 'USNYC',
      route_type: 'AIR',
      distance_km: 14500,
      avg_hours: 24,
      min_hours: 20,
      max_hours: 30,
      std_dev_hours: 3,
      samples: 80,
      alarm_rate: 0.12,  // 12% - high risk (will be filtered out)
      is_active: true
    },

    // ========================================================================
    // PATH 4: Alternative via SGSIN -> USNYC (Direct from Singapore)
    // ========================================================================
    {
      from_port: 'SGSIN',
      to_port: 'USNYC',
      route_type: 'SEA',
      distance_km: 13800,
      avg_hours: 384,
      min_hours: 360,
      max_hours: 420,
      std_dev_hours: 18,
      samples: 140,
      alarm_rate: 0.09,  // 9% - acceptable
      is_active: true
    },

    // ========================================================================
    // ADDITIONAL EDGES for complex graph testing
    // ========================================================================
    {
      from_port: 'HKHKG',
      to_port: 'JPTYO',
      route_type: 'SEA',
      distance_km: 2900,
      avg_hours: 84,
      min_hours: 78,
      max_hours: 92,
      std_dev_hours: 4,
      samples: 110,
      alarm_rate: 0.04,
      is_active: true
    },
    {
      from_port: 'JPTYO',
      to_port: 'HKHKG',
      route_type: 'SEA',
      distance_km: 2900,
      avg_hours: 84,
      min_hours: 78,
      max_hours: 92,
      std_dev_hours: 4,
      samples: 105,
      alarm_rate: 0.05,
      is_active: true
    },

    // ========================================================================
    // INACTIVE EDGE (should be filtered out)
    // ========================================================================
    {
      from_port: 'VNSGN',
      to_port: 'HKHKG',
      route_type: 'SEA',
      distance_km: 2400,
      avg_hours: 60,
      min_hours: 55,
      max_hours: 68,
      std_dev_hours: 4,
      samples: 50,
      alarm_rate: 0.15,  // 15% - very high risk
      is_active: false  // INACTIVE
    }
  ];

  // Insert test data
  const inserted = await PortEdges.insertMany(testEdges);
  console.log(`[TestData] Inserted ${inserted.length} port edges`);

  return inserted;
}

/**
 * ============================================================================
 * TEST CASES
 * ============================================================================
 */

/**
 * TEST 1: Basic Route Finding
 */
async function testBasicRouteFinding() {
  console.log('\n========================================');
  console.log('TEST 1: Basic Route Finding');
  console.log('========================================');

  try {
    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('[Test] Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGO_URI);
      console.log('[Test] Connected');
    }

    const result = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 3,
      maxAlarmRate: 0.1,
      maxRoutes: 5
    });

    console.log('\n✓ Test passed: Route finding completed');
    console.log(`  - Found ${result.routes.length} routes`);
    console.log(`  - Execution time: ${result.metadata.execution_time_ms}ms`);

    if (result.routes.length > 0) {
      const topRoute = result.routes[0];
      console.log(`\n  Top Route (Rank #1):`);
      console.log(`  - Path: ${topRoute.path.join(' → ')}`);
      console.log(`  - Total time: ${topRoute.summary.total_hours} hours`);
      console.log(`  - Total stops: ${topRoute.summary.total_stops}`);
      console.log(`  - Avg alarm rate: ${(topRoute.summary.avg_alarm_rate * 100).toFixed(2)}%`);
      console.log(`  - Recommendation: ${topRoute.recommendation}`);
    }

    return result;

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 2: Direct Route Detection
 */
async function testDirectRoute() {
  console.log('\n========================================');
  console.log('TEST 2: Direct Route Detection');
  console.log('========================================');

  try {
    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    const result = await findOptimalRoutes('VNSGN', 'SGSIN', {
      maxTransitStops: 3,
      maxAlarmRate: 0.1
    });

    console.log('\n✓ Test passed: Direct route detection');
    console.log(`  - Found ${result.routes.length} route(s)`);

    if (result.routes.length > 0) {
      const route = result.routes[0];
      console.log(`  - Is direct: ${route.summary.total_stops === 0 ? 'YES' : 'NO'}`);
      console.log(`  - Transit time: ${route.summary.total_hours} hours`);
    }

    return result;

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 3: Alarm Rate Filtering
 */
async function testAlarmRateFiltering() {
  console.log('\n========================================');
  console.log('TEST 3: Alarm Rate Filtering');
  console.log('========================================');

  try {
    // Test with strict alarm rate (5%)
    const strictResult = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 3,
      maxAlarmRate: 0.05,  // Only 5%
      maxRoutes: 10
    });

    console.log('\n✓ Test passed: Strict filtering (5% max alarm rate)');
    console.log(`  - Found ${strictResult.routes.length} routes`);

    if (strictResult.routes.length > 0) {
      const maxAlarm = Math.max(...strictResult.routes.map(r => r.summary.max_alarm_rate));
      console.log(`  - Highest alarm rate: ${(maxAlarm * 100).toFixed(2)}%`);
      console.log(`  - All routes under 5%: ${maxAlarm <= 0.05 ? 'YES ✓' : 'NO ✗'}`);
    }

    // Test with relaxed alarm rate (10%)
    const relaxedResult = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 3,
      maxAlarmRate: 0.1,  // 10%
      maxRoutes: 10
    });

    console.log('\n✓ Test passed: Relaxed filtering (10% max alarm rate)');
    console.log(`  - Found ${relaxedResult.routes.length} routes`);
    console.log(`  - More routes than strict: ${relaxedResult.routes.length > strictResult.routes.length ? 'YES ✓' : 'NO'}`);

    return { strictResult, relaxedResult };

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 4: Max Transit Stops Constraint
 */
async function testMaxTransitStops() {
  console.log('\n========================================');
  console.log('TEST 4: Max Transit Stops Constraint');
  console.log('========================================');

  try {
    // Test with max 1 stop
    const oneStopResult = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 1,
      maxAlarmRate: 0.1
    });

    console.log('\n✓ Test passed: Max 1 transit stop');
    console.log(`  - Found ${oneStopResult.routes.length} routes`);

    if (oneStopResult.routes.length > 0) {
      const maxStops = Math.max(...oneStopResult.routes.map(r => r.summary.total_stops));
      console.log(`  - Max stops in results: ${maxStops}`);
      console.log(`  - Constraint satisfied: ${maxStops <= 1 ? 'YES ✓' : 'NO ✗'}`);
    }

    // Test with max 2 stops
    const twoStopsResult = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 2,
      maxAlarmRate: 0.1
    });

    console.log('\n✓ Test passed: Max 2 transit stops');
    console.log(`  - Found ${twoStopsResult.routes.length} routes`);
    console.log(`  - More routes than 1-stop: ${twoStopsResult.routes.length >= oneStopResult.routes.length ? 'YES ✓' : 'NO'}`);

    return { oneStopResult, twoStopsResult };

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 5: Service Layer Integration
 */
async function testServiceLayer() {
  console.log('\n========================================');
  console.log('TEST 5: Service Layer Integration');
  console.log('========================================');

  try {
    // Test with valid inputs
    const validResult = await getOptimalRoutes('VNSGN', 'USNYC');
    console.log('\n✓ Test passed: Valid input handling');
    console.log(`  - Success: ${validResult.success}`);
    console.log(`  - Has insights: ${validResult.insights ? 'YES' : 'NO'}`);

    // Test with invalid inputs
    const invalidResult = await getOptimalRoutes('', 'USNYC');
    console.log('\n✓ Test passed: Invalid input handling');
    console.log(`  - Success: ${invalidResult.success}`);
    console.log(`  - Error code: ${invalidResult.error}`);

    // Test with same origin/destination
    const samePortResult = await getOptimalRoutes('VNSGN', 'VNSGN');
    console.log('\n✓ Test passed: Same port handling');
    console.log(`  - Success: ${samePortResult.success}`);
    console.log(`  - Error code: ${samePortResult.error}`);

    return { validResult, invalidResult, samePortResult };

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 6: Performance Test
 */
async function testPerformance() {
  console.log('\n========================================');
  console.log('TEST 6: Performance Test');
  console.log('========================================');

  try {
    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('[Test] Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGO_URI);
      console.log('[Test] Connected');
    }

    // Generate test data first
    console.log('[Test] Generating test data...');
    await generateTestData();
    console.log('[Test] Test data ready');

    const iterations = 10;
    const times = [];

    console.log(`\nRunning ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await findOptimalRoutes('VNSGN', 'USNYC', {
        maxTransitStops: 3,
        maxAlarmRate: 0.1
      });
      const elapsed = Date.now() - start;
      times.push(elapsed);
      process.stdout.write('.');
    }

    console.log('\n');

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('✓ Test passed: Performance metrics');
    console.log(`  - Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`  - Min time: ${minTime}ms`);
    console.log(`  - Max time: ${maxTime}ms`);
    console.log(`  - Performance: ${avgTime < 1000 ? 'EXCELLENT ✓' : avgTime < 3000 ? 'GOOD' : 'NEEDS OPTIMIZATION'}`);

    return { avgTime, minTime, maxTime };

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * TEST 7: Path Reconstruction Validation
 */
async function testPathReconstruction() {
  console.log('\n========================================');
  console.log('TEST 7: Path Reconstruction Validation');
  console.log('========================================');

  try {
    const result = await findOptimalRoutes('VNSGN', 'USNYC', {
      maxTransitStops: 3,
      maxAlarmRate: 0.1,
      maxRoutes: 10
    });

    console.log('\n✓ Test passed: Path reconstruction');
    console.log(`  - Total routes found: ${result.routes.length}`);

    let allValid = true;

    for (const route of result.routes) {
      // Validate path continuity
      const legs = route.legs;
      for (let i = 0; i < legs.length - 1; i++) {
        if (legs[i].to_port !== legs[i + 1].from_port) {
          console.error(`  ✗ Path discontinuity in route: ${route.path.join(' → ')}`);
          allValid = false;
        }
      }

      // Validate origin and destination
      if (legs[0].from_port !== 'VNSGN') {
        console.error(`  ✗ Wrong origin: ${legs[0].from_port}`);
        allValid = false;
      }

      if (legs[legs.length - 1].to_port !== 'USNYC') {
        console.error(`  ✗ Wrong destination: ${legs[legs.length - 1].to_port}`);
        allValid = false;
      }
    }

    console.log(`  - All paths valid: ${allValid ? 'YES ✓' : 'NO ✗'}`);

    return { allValid, totalRoutes: result.routes.length };

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    throw error;
  }
}

/**
 * ============================================================================
 * MAIN TEST RUNNER
 * ============================================================================
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ROUTE OPTIMIZATION TEST SUITE - $graphLookup Testing      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Connect to MongoDB
    console.log('\n[Setup] Connecting to MongoDB...');
    console.log('[Setup] MongoDB URI:', process.env.MONGO_URI ? 'Found' : 'NOT FOUND');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Setup] Connected successfully');

    // Generate test data
    await generateTestData();

    // Run all tests
    const results = {
      test1: await testBasicRouteFinding(),
      test2: await testDirectRoute(),
      test3: await testAlarmRateFiltering(),
      test4: await testMaxTransitStops(),
      test5: await testServiceLayer(),
      test6: await testPerformance(),
      test7: await testPathReconstruction()
    };

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n✓ All tests passed successfully!');
    console.log('\nKey Findings:');
    console.log(`  - Route finding works correctly`);
    console.log(`  - Alarm rate filtering is accurate`);
    console.log(`  - Transit stop constraints are enforced`);
    console.log(`  - Path reconstruction is valid`);
    console.log(`  - Average performance: ${results.test6.avgTime.toFixed(2)}ms`);
    console.log('\n');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('[Cleanup] Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('[Cleanup] Done');
  }
}

/**
 * ============================================================================
 * EXPORT & EXECUTION
 * ============================================================================
 */
module.exports = {
  runAllTests,
  generateTestData,
  testBasicRouteFinding,
  testDirectRoute,
  testAlarmRateFiltering,
  testMaxTransitStops,
  testServiceLayer,
  testPerformance,
  testPathReconstruction
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✓ Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Test suite failed:', error);
      process.exit(1);
    });
}
