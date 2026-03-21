# Quick Start Guide - Route Optimization API

Hướng dẫn nhanh để test và sử dụng API Route Optimization.

## Bước 1: Chuẩn bị dữ liệu test

### Tạo dữ liệu mẫu trong MongoDB

```bash
# Chạy script tạo test data
cd src
node database/test/test_route_optimization.js
```

Script này sẽ:
- Kết nối MongoDB
- Xóa dữ liệu cũ trong collection `port_edges`
- Tạo mạng lưới cảng mẫu với các routes:
  - VNSGN → SGSIN → HKHKG → USNYC
  - VNSGN → MYTPP → JPTYO → USNYC
  - VNSGN → USNYC (direct)
  - Và nhiều routes khác

**Expected Output:**
```
[TestData] Inserted 12 port edges
✓ All tests passed successfully!
```

## Bước 2: Khởi động server

```bash
cd src
npm start
```

**Expected Output:**
```
Server is running on port 3000
MongoDB connected successfully
MySQL connected successfully
```

## Bước 3: Test API

### Option 1: Sử dụng curl

#### Test cơ bản
```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC"
```

#### Test với constraints
```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.05&maxTransitStops=2"
```

### Option 2: Sử dụng test script

```bash
# Chạy tất cả tests
node test/test_route_optimization_api.js

# Chạy test cụ thể
node test/test_route_optimization_api.js basic
node test/test_route_optimization_api.js strict
node test/test_route_optimization_api.js errors
```

### Option 3: Sử dụng Postman

1. Mở Postman
2. Import collection: `src/test/RouteOptimization_Postman_Collection.json`
3. Chạy các requests trong collection

## Bước 4: Hiểu kết quả

### Ví dụ response thành công

```json
{
  "success": true,
  "routes": [
    {
      "rank": 1,
      "path": ["VNSGN", "SGSIN", "HKHKG", "USNYC"],
      "legs": [
        {
          "from_port": "VNSGN",
          "to_port": "SGSIN",
          "avg_hours": 48,
          "distance_km": 1200,
          "alarm_rate": 0.06,
          "route_type": "SEA"
        }
        // ... more legs
      ],
      "summary": {
        "total_stops": 2,
        "total_hours": 480,
        "total_distance_km": 16600,
        "avg_alarm_rate": 0.06,
        "max_alarm_rate": 0.08,
        "route_types": ["SEA"],
        "optimization_score": 0.45
      },
      "recommendation": "RECOMMENDED"
    }
  ],
  "metadata": {
    "origin": "VNSGN",
    "destination": "USNYC",
    "total_paths_found": 8,
    "returned_routes": 5,
    "execution_time_ms": 245
  },
  "insights": [
    {
      "type": "FAST_DELIVERY",
      "message": "Fastest route delivers in 480 hours (< 20 days)"
    }
  ]
}
```

### Giải thích các trường quan trọng

| Field | Ý nghĩa |
|-------|---------|
| `rank` | Thứ hạng route (1 = tốt nhất) |
| `path` | Danh sách cảng theo thứ tự |
| `total_hours` | Tổng thời gian di chuyển |
| `total_stops` | Số trạm dừng (không tính origin/destination) |
| `avg_alarm_rate` | Tỷ lệ cảnh báo trung bình (0-1) |
| `optimization_score` | Điểm tối ưu (thấp hơn = tốt hơn) |
| `recommendation` | Mức độ khuyến nghị sử dụng |

## Bước 5: Test các scenarios khác nhau

### Scenario 1: Vaccine Shipment (Strict Safety)

**Yêu cầu:**
- Alarm rate < 5%
- Tối đa 2 trạm dừng
- Chỉ lấy top 3 routes

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.05&maxTransitStops=2&maxRoutes=3"
```

**Expected:** Routes có alarm_rate thấp, ít trạm dừng

### Scenario 2: Direct Route Only

**Yêu cầu:**
- Không có trạm dừng
- Chỉ direct routes

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=SGSIN&maxTransitStops=0"
```

**Expected:** Chỉ trả về direct route VNSGN → SGSIN

### Scenario 3: Sea Routes Only

**Yêu cầu:**
- Chỉ đường biển
- Loại bỏ air/land routes

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&routeType=SEA"
```

**Expected:** Tất cả routes có route_type = "SEA"

## Bước 6: Xử lý lỗi

### Lỗi 1: Missing Parameters

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN"
```

**Response:**
```json
{
  "success": false,
  "error": "MISSING_PARAMETERS",
  "message": "Both origin and destination ports are required"
}
```

### Lỗi 2: Invalid Parameter

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=1.5"
```

**Response:**
```json
{
  "success": false,
  "error": "INVALID_PARAMETER",
  "message": "maxAlarmRate must be between 0 and 1"
}
```

### Lỗi 3: Port Not Found

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=INVALID&destination=USNYC"
```

**Response:**
```json
{
  "success": false,
  "error": "PORT_NOT_FOUND",
  "message": "Origin port INVALID not found in database"
}
```

### Lỗi 4: No Routes Found

```bash
curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.01&maxTransitStops=0"
```

**Response:**
```json
{
  "success": false,
  "error": "NO_ROUTES_FOUND",
  "message": "No routes found from VNSGN to USNYC with given constraints"
}
```

## Bước 7: Kiểm tra performance

### Đo thời gian response

```bash
time curl "http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC"
```

**Expected:** < 500ms cho test data

### Chạy performance test

```bash
node database/test/test_route_optimization.js
```

Xem phần "TEST 6: Performance Test" trong output.

## Troubleshooting

### Vấn đề 1: Server không khởi động

**Triệu chứng:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Giải pháp:**
```bash
# Kiểm tra MongoDB đang chạy
mongosh

# Nếu không chạy, khởi động MongoDB
# Windows: net start MongoDB
# Linux/Mac: sudo systemctl start mongod
```

### Vấn đề 2: No routes found

**Triệu chứng:**
```json
{
  "success": false,
  "error": "NO_ROUTES_FOUND"
}
```

**Giải pháp:**
```bash
# Tạo lại test data
node database/test/test_route_optimization.js

# Kiểm tra dữ liệu trong MongoDB
mongosh
use supply_chain
db.port_edges.find().pretty()
```

### Vấn đề 3: API trả về 404

**Triệu chứng:**
```
Cannot GET /api/v1/analytics/route-optimization
```

**Giải pháp:**
```bash
# Kiểm tra route đã được register
# Xem file: src/routes/telemetry.route.js
# Đảm bảo có dòng:
# router.get('/v1/analytics/route-optimization', routeOptimizationController);

# Restart server
npm start
```

### Vấn đề 4: Slow response

**Triệu chứng:**
Response time > 2 seconds

**Giải pháp:**
```bash
# Tạo indexes
node database/mongo/create_indexes.js

# Kiểm tra indexes
mongosh
use supply_chain
db.port_edges.getIndexes()
```

## Next Steps

1. **Tích hợp vào frontend:**
   - Hiển thị routes trên map
   - So sánh multiple routes
   - Visualize optimization score

2. **Thêm features:**
   - Cache popular routes
   - Real-time updates
   - Weather integration
   - Cost optimization

3. **Production deployment:**
   - Add authentication
   - Implement rate limiting
   - Setup monitoring
   - Configure logging

## Tài liệu tham khảo

- [API Documentation](./API_ROUTE_OPTIMIZATION.md)
- [Technical Guide](./ROUTE_OPTIMIZATION_TECHNICAL_GUIDE.md)
- [System Design](./design.md)

## Support

Nếu gặp vấn đề:
1. Check logs trong console
2. Xem test cases trong `src/test/`
3. Review documentation
4. Contact development team
