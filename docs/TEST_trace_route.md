# Trace Route Aggregation - Test Guide

## Tổng Quan

Có 2 file test cho MongoDB Trace Route Aggregation:

1. **simple_test_trace_route.js** - Standalone test (không cần dependencies)
2. **test_trace_route_aggregation.js** - Full test suite với Mocha/Chai

---

## Quick Start - Simple Test

### Yêu Cầu
- Node.js
- MongoDB đang chạy
- Đã cài đặt dependencies: `mongoose`

### Chạy Test

```bash
# Từ thư mục gốc của project
node src/database/mongo/simple_test_trace_route.js
```

### Kết Quả Mong Đợi

```
████████████████████████████████████████████████████████████████████████████████
TRACE ROUTE AGGREGATION - SIMPLE TEST SUITE
████████████████████████████████████████████████████████████████████████████████

[Setup] Connecting to MongoDB...
[Setup] ✓ Connected
[Setup] Cleaning test data...
[Setup] ✓ Cleaned

▶ Running: Test 1: Should return GeoJSON FeatureCollection
  ✓ PASSED

▶ Running: Test 2: Should have correct metadata structure
  ✓ PASSED

▶ Running: Test 3: Features should have correct structure
  ✓ PASSED

... (13 tests total)

[Cleanup] Cleaning test data...
[Cleanup] ✓ Cleaned
[Cleanup] Disconnecting from MongoDB...
[Cleanup] ✓ Disconnected

================================================================================
TEST SUMMARY
================================================================================
Total: 13
✓ Passed: 13
✗ Failed: 0
================================================================================
```

---

## Full Test Suite - Mocha/Chai

### Yêu Cầu Bổ Sung

```bash
npm install --save-dev mocha chai
```

### Chạy Test

```bash
# Option 1: Trực tiếp với Node
node src/database/mongo/test_trace_route_aggregation.js

# Option 2: Với Mocha CLI
npx mocha src/database/mongo/test_trace_route_aggregation.js

# Option 3: Thêm vào package.json scripts
npm test
```

### Thêm vào package.json

```json
{
  "scripts": {
    "test": "mocha src/database/mongo/test_trace_route_aggregation.js",
    "test:simple": "node src/database/mongo/simple_test_trace_route.js",
    "test:watch": "mocha src/database/mongo/test_trace_route_aggregation.js --watch"
  }
}
```

---

## Test Coverage

### 1. Basic Functionality (4 tests)
- ✓ GeoJSON FeatureCollection format
- ✓ Metadata structure
- ✓ Feature structure
- ✓ Required properties

### 2. Downsampling Logic (4 tests)
- ✓ No downsampling when points < maxPoints
- ✓ Downsampling when points > maxPoints
- ✓ Correct sampling ratio calculation
- ✓ Chronological order maintenance

### 3. Violation Detection (5 tests)
- ✓ Identify violations correctly
- ✓ Identify non-violations correctly
- ✓ Calculate violation rate
- ✓ Classify violation severity (WARNING/HIGH/CRITICAL)
- ✓ Calculate temperature delta

### 4. Statistics Calculation (3 tests)
- ✓ Temperature statistics (min/max/avg)
- ✓ Data reduction percentage
- ✓ Execution time tracking

### 5. Edge Cases (5 tests)
- ✓ Empty dataset
- ✓ Single data point
- ✓ Very large dataset (10,000 points)
- ✓ Extreme temperature values
- ✓ Different threshold values

### 6. Performance Tests (3 tests)
- ✓ Small dataset < 100ms
- ✓ Medium dataset < 500ms
- ✓ Consistent performance across runs

### 7. Data Quality (3 tests)
- ✓ Temperature rounding (2 decimals)
- ✓ Valid coordinates (lng: -180 to 180, lat: -90 to 90)
- ✓ Valid timestamps

**Total: 27 test cases**

---

## Test Data Generator

### Sử Dụng Test Data Generator

```javascript
const { TestDataGenerator } = require('./test_trace_route_aggregation');

// Generate 100 points với default settings
const data = TestDataGenerator.generateTelemetryPoints({ count: 100 });

// Generate với custom options
const customData = TestDataGenerator.generateTelemetryPoints({
  shipmentId: 'MY-SHIPMENT-001',
  deviceId: 'MY-DEVICE-001',
  count: 500,
  startTime: new Date('2024-01-15T00:00:00Z'),
  intervalMinutes: 5,
  baseTemp: 6.0,
  tempVariation: 4.0,
  violationRate: 0.2,  // 20% violations
  route: [
    { lng: 106.7, lat: 10.8 },  // Ho Chi Minh
    { lng: 103.8, lat: 1.3 },   // Singapore
    { lng: -74.0, lat: 40.7 }   // New York
  ]
});

// Generate edge cases
const edgeCases = TestDataGenerator.generateEdgeCases();
// edgeCases.empty - Empty dataset
// edgeCases.single - Single point
// edgeCases.small - 50 points
// edgeCases.large - 5000 points
// edgeCases.allViolations - 100% violations
// edgeCases.noViolations - 0% violations
// edgeCases.extremeTemps - -20°C to 80°C
```

---

## Troubleshooting

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
1. Kiểm tra MongoDB đang chạy: `mongod --version`
2. Start MongoDB: `mongod` hoặc `brew services start mongodb-community`
3. Hoặc set custom URI: `export MONGO_URI=mongodb://your-host:27017/dbname`

### Test Timeout

```
Error: Timeout of 30000ms exceeded
```

**Solution:**
1. Tăng timeout trong test:
```javascript
this.timeout(60000); // 60 seconds
```

2. Hoặc chạy với timeout cao hơn:
```bash
mocha --timeout 60000 src/database/mongo/test_trace_route_aggregation.js
```

### Memory Issues với Large Dataset

```
JavaScript heap out of memory
```

**Solution:**
1. Tăng memory limit:
```bash
node --max-old-space-size=4096 src/database/mongo/test_trace_route_aggregation.js
```

2. Giảm test data size trong edge cases

---

## Performance Benchmarks

### Expected Performance (Local Development)

| Dataset Size | Expected Time | Actual (Avg) |
|-------------|---------------|--------------|
| 100 points  | < 100ms       | ~50ms        |
| 500 points  | < 200ms       | ~100ms       |
| 1,000 points| < 300ms       | ~150ms       |
| 5,000 points| < 1,000ms     | ~500ms       |
| 10,000 points| < 2,000ms    | ~1,000ms     |

### Performance Tips

1. **Ensure Indexes Exist:**
```bash
node src/database/mongo/create_indexes.js create
```

2. **Monitor Query Performance:**
```javascript
// Add explain() to see query plan
const explain = await TelemetryPoints.aggregate(pipeline).explain('executionStats');
console.log(JSON.stringify(explain, null, 2));
```

3. **Check Index Usage:**
```javascript
// In MongoDB shell
db.telemetry_points.aggregate([{ $indexStats: {} }])
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Trace Route Aggregation

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:4.4
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run simple tests
        run: npm run test:simple
        env:
          MONGO_URI: mongodb://localhost:27017/supply_chain_test
      
      - name: Run full test suite
        run: npm test
        env:
          MONGO_URI: mongodb://localhost:27017/supply_chain_test
```

---

## Manual Testing

### Test với Real Data

```javascript
const mongoose = require('mongoose');
const { traceRouteAggregation } = require('./trace_route_aggregation');

async function testWithRealData() {
  await mongoose.connect('mongodb://localhost:27017/supply_chain');
  
  // Test với shipment thực tế
  const result = await traceRouteAggregation(
    'SHP-2024-001234',  // Real shipment ID
    8.0,                // Temp threshold
    1000                // Max points
  );
  
  console.log('Metadata:', result.metadata);
  console.log('Features count:', result.features.length);
  console.log('Violations:', result.metadata.violation_count);
  
  await mongoose.disconnect();
}

testWithRealData();
```

### Test Performance với Different Scenarios

```javascript
async function performanceTest() {
  const scenarios = [
    { name: 'Small', count: 100, maxPoints: 100 },
    { name: 'Medium', count: 1000, maxPoints: 200 },
    { name: 'Large', count: 5000, maxPoints: 500 },
    { name: 'Huge', count: 10000, maxPoints: 1000 }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\nTesting ${scenario.name}...`);
    
    // Generate and insert test data
    const testData = generateTestData(scenario.count);
    await TelemetryPoints.insertMany(testData);
    
    // Run aggregation
    const startTime = Date.now();
    const result = await traceRouteAggregation(
      'TEST-PERF',
      8.0,
      scenario.maxPoints
    );
    const duration = Date.now() - startTime;
    
    console.log(`  - Duration: ${duration}ms`);
    console.log(`  - Throughput: ${(scenario.count / duration * 1000).toFixed(0)} points/sec`);
    console.log(`  - Reduction: ${result.metadata.data_reduction_pct}%`);
    
    // Cleanup
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': 'TEST-PERF' });
  }
}
```

---

## Next Steps

1. **Run Simple Test First:**
   ```bash
   node src/database/mongo/simple_test_trace_route.js
   ```

2. **If Successful, Run Full Suite:**
   ```bash
   npm install --save-dev mocha chai
   node src/database/mongo/test_trace_route_aggregation.js
   ```

3. **Create Indexes:**
   ```bash
   node src/database/mongo/create_indexes.js create
   ```

4. **Test với Real Data:**
   - Modify test scripts với real shipment IDs
   - Compare performance với test data

5. **Monitor Performance:**
   - Use MongoDB profiler
   - Check slow query log
   - Analyze index usage

---

## Support

Nếu gặp vấn đề:
1. Check MongoDB connection
2. Verify indexes exist
3. Check test data generation
4. Review error logs
5. Adjust timeout settings

Happy Testing! 🚀
