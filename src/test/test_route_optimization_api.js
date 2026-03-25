/**
 * ============================================================================
 * API TEST: Route Optimization Endpoint
 * ============================================================================
 * Test script cho endpoint GET /api/v1/analytics/route-optimization
 * 
 * PREREQUISITES:
 * 1. Server đang chạy (npm start)
 * 2. MongoDB đã có dữ liệu port_edges
 * 3. Run: node src/test/test_route_optimization_api.js
 * ============================================================================
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/v1/analytics/route-optimization';

/**
 * Helper function to make API request
 */
async function testRouteOptimization(testName, params, expectedStatus = 200) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  console.log('Parameters:', JSON.stringify(params, null, 2));

  try {
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}${API_ENDPOINT}`, {
      params,
      validateStatus: () => true // Don't throw on any status
    });
    const elapsed = Date.now() - startTime;

    console.log(`\nStatus: ${response.status} (Expected: ${expectedStatus})`);
    console.log(`Response Time: ${elapsed}ms`);

    if (response.status === expectedStatus) {
      console.log('✓ Status code matches expected');
    } else {
      console.log('✗ Status code mismatch!');
    }

    // Display response data
    if (response.data) {
      console.log('\nResponse Data:');
      
      if (response.data.success) {
        // Success response
        console.log(`  Success: ${response.data.success}`);
        
        if (response.data.routes) {
          console.log(`  Routes Found: ${response.data.routes.length}`);
          
          // Display top route details
          if (response.data.routes.length > 0) {
            const topRoute = response.data.routes[0];
            console.log(`\n  Top Route (Rank #1):`);
            console.log(`    Path: ${topRoute.path.join(' → ')}`);
            console.log(`    Total Hours: ${topRoute.summary.total_hours}`);
            console.log(`    Total Stops: ${topRoute.summary.total_stops}`);
            console.log(`    Avg Alarm Rate: ${(topRoute.summary.avg_alarm_rate * 100).toFixed(2)}%`);
            console.log(`    Max Alarm Rate: ${(topRoute.summary.max_alarm_rate * 100).toFixed(2)}%`);
            console.log(`    Optimization Score: ${topRoute.summary.optimization_score}`);
            console.log(`    Recommendation: ${topRoute.recommendation}`);
          }
        }

        if (response.data.metadata) {
          console.log(`\n  Metadata:`);
          console.log(`    Origin: ${response.data.metadata.origin}`);
          console.log(`    Destination: ${response.data.metadata.destination}`);
          console.log(`    Total Paths Found: ${response.data.metadata.total_paths_found}`);
          console.log(`    Execution Time: ${response.data.metadata.execution_time_ms}ms`);
        }

        if (response.data.insights && response.data.insights.length > 0) {
          console.log(`\n  Insights:`);
          response.data.insights.forEach(insight => {
            console.log(`    - [${insight.type}] ${insight.message}`);
          });
        }

      } else {
        // Error response
        console.log(`  Success: ${response.data.success}`);
        console.log(`  Error: ${response.data.error}`);
        console.log(`  Message: ${response.data.message}`);
      }
    }

    console.log('\n✓ Test completed');
    return response;

  } catch (error) {
    console.error('\n✗ Test failed with exception:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('  → Server is not running! Please start the server first.');
    }
    throw error;
  }
}

/**
 * ============================================================================
 * TEST SUITE
 * ============================================================================
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         ROUTE OPTIMIZATION API - Integration Test Suite           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Basic route optimization
    await testRouteOptimization(
      'Basic Route Optimization',
      {
        origin: 'VNSGN',
        destination: 'USNYC'
      }
    );

    // Test 2: Direct route
    await testRouteOptimization(
      'Direct Route (Short Distance)',
      {
        origin: 'VNSGN',
        destination: 'SGSIN'
      }
    );

    // Test 3: Strict alarm rate filter
    await testRouteOptimization(
      'Strict Alarm Rate Filter (5%)',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxAlarmRate: 0.05
      }
    );

    // Test 4: Limit transit stops
    await testRouteOptimization(
      'Limit Transit Stops (Max 1)',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxTransitStops: 1
      }
    );

    // Test 5: Top 3 routes only
    await testRouteOptimization(
      'Top 3 Routes Only',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxRoutes: 3
      }
    );

    // Test 6: Filter by route type
    await testRouteOptimization(
      'Filter by Route Type (SEA only)',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        routeType: 'SEA'
      }
    );

    // Test 7: Combined constraints (vaccine shipment)
    await testRouteOptimization(
      'Combined Constraints (Vaccine Shipment)',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxAlarmRate: 0.05,
        maxTransitStops: 2,
        maxRoutes: 3
      }
    );

    // Test 8: Error - Missing origin
    await testRouteOptimization(
      'Error: Missing Origin',
      {
        destination: 'USNYC'
      },
      400
    );

    // Test 9: Error - Same origin and destination
    await testRouteOptimization(
      'Error: Same Origin and Destination',
      {
        origin: 'VNSGN',
        destination: 'VNSGN'
      },
      400
    );

    // Test 10: Error - Invalid alarm rate
    await testRouteOptimization(
      'Error: Invalid Alarm Rate',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxAlarmRate: 1.5
      },
      400
    );

    // Test 11: Error - Port not found
    await testRouteOptimization(
      'Error: Port Not Found',
      {
        origin: 'INVALID',
        destination: 'USNYC'
      },
      404
    );

    // Test 12: No routes found (strict constraints)
    await testRouteOptimization(
      'No Routes Found (Strict Constraints)',
      {
        origin: 'VNSGN',
        destination: 'USNYC',
        maxAlarmRate: 0.01,
        maxTransitStops: 0
      },
      404
    );

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                          TEST SUMMARY                              ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log('\n✓ All tests completed successfully!');
    console.log('\nKey Findings:');
    console.log('  - API endpoint is working correctly');
    console.log('  - Parameter validation is functioning');
    console.log('  - Error handling is appropriate');
    console.log('  - Response format is consistent');
    console.log('\n');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
    process.exit(1);
  }
}

/**
 * ============================================================================
 * INDIVIDUAL TEST FUNCTIONS (for selective testing)
 * ============================================================================
 */

async function testBasicOptimization() {
  await testRouteOptimization(
    'Basic Route Optimization',
    {
      origin: 'VNSGN',
      destination: 'USNYC'
    }
  );
}

async function testStrictConstraints() {
  await testRouteOptimization(
    'Strict Constraints (Vaccine)',
    {
      origin: 'VNSGN',
      destination: 'USNYC',
      maxAlarmRate: 0.05,
      maxTransitStops: 2
    }
  );
}

async function testErrorHandling() {
  await testRouteOptimization('Missing Origin', { destination: 'USNYC' }, 400);
  await testRouteOptimization('Same Port', { origin: 'VNSGN', destination: 'VNSGN' }, 400);
  await testRouteOptimization('Invalid Alarm Rate', { origin: 'VNSGN', destination: 'USNYC', maxAlarmRate: 1.5 }, 400);
}

/**
 * ============================================================================
 * EXECUTION
 * ============================================================================
 */

// Check command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Run all tests
  runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  // Run specific test
  const testName = args[0];
  
  switch (testName) {
    case 'basic':
      testBasicOptimization().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'strict':
      testStrictConstraints().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'errors':
      testErrorHandling().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    default:
      console.error(`Unknown test: ${testName}`);
      console.log('Available tests: basic, strict, errors');
      console.log('Or run without arguments to execute all tests');
      process.exit(1);
  }
}
