# API 5.2: Route Optimization (Tối ưu hóa lộ trình)

## Tổng quan

API Route Optimization giúp tìm lộ trình tối ưu giữa 2 cảng dựa trên dữ liệu lịch sử của hàng ngàn lô hàng trước đó. Đây là chức năng nâng cao sử dụng MongoDB $graphLookup để thực hiện graph traversal và tìm kiếm đường đi tối ưu.

## Endpoint

```
GET /api/v1/analytics/route-optimization
```

## Business Requirements (BR-14)

- Tìm lộ trình nhanh nhất và an toàn nhất từ cảng A đến cảng B
- Loại bỏ các chặng có tỷ lệ cảnh báo cao (alarm_rate > 10%)
- Ưu tiên routes có thời gian di chuyển thấp nhất
- Giới hạn số trạm dừng tối đa để giảm rủi ro
- Phù hợp cho hàng nhạy cảm (vaccine, dược phẩm, điện tử)

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `origin` | string | ✓ | - | Mã cảng xuất phát (e.g., "VNSGN") |
| `destination` | string | ✓ | - | Mã cảng đích (e.g., "USNYC") |
| `maxTransitStops` | integer | ✗ | 3 | Số trạm dừng tối đa (0-5) |
| `maxAlarmRate` | float | ✗ | 0.1 | Tỷ lệ alarm tối đa chấp nhận (0-1) |
| `maxRoutes` | integer | ✗ | 5 | Số lộ trình tối đa trả về (1-20) |
| `routeType` | string | ✗ | ALL | Loại vận chuyển (SEA, AIR, LAND, MULTIMODAL) |

## Request Examples

### 1. Basic Request

```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC
```

### 2. Strict Constraints (Vaccine Shipment)

```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.05&maxTransitStops=2
```

### 3. Filter by Route Type

```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&routeType=SEA
```

## Response Format

### Success Response (200 OK)

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
        },
        {
          "from_port": "SGSIN",
          "to_port": "HKHKG",
          "avg_hours": 72,
          "distance_km": 2600,
          "alarm_rate": 0.04,
          "route_type": "SEA"
        },
        {
          "from_port": "HKHKG",
          "to_port": "USNYC",
          "avg_hours": 360,
          "distance_km": 12800,
          "alarm_rate": 0.08,
          "route_type": "SEA"
        }
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
    "constraints": {
      "max_transit_stops": 3,
      "max_alarm_rate": 0.1,
      "route_type": "ALL"
    },
    "execution_time_ms": 245,
    "generated_at": "2024-01-15T10:30:00.000Z"
  },
  "insights": [
    {
      "type": "FAST_DELIVERY",
      "message": "Fastest route delivers in 480 hours (< 20 days)"
    },
    {
      "type": "HIGH_SAFETY",
      "message": "Top route has excellent safety record (< 5% alarm rate)"
    },
    {
      "type": "MULTIPLE_OPTIONS",
      "message": "8 alternative routes available for flexibility"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Missing Parameters

```json
{
  "success": false,
  "error": "MISSING_PARAMETERS",
  "message": "Both origin and destination ports are required"
}
```

#### 400 Bad Request - Same Port

```json
{
  "success": false,
  "error": "SAME_PORT",
  "message": "Origin and destination cannot be the same"
}
```

#### 400 Bad Request - Invalid Parameter

```json
{
  "success": false,
  "error": "INVALID_PARAMETER",
  "message": "maxAlarmRate must be between 0 and 1"
}
```

#### 404 Not Found - Port Not Found

```json
{
  "success": false,
  "error": "PORT_NOT_FOUND",
  "message": "Origin port INVALID not found in database"
}
```

#### 404 Not Found - No Routes Found

```json
{
  "success": false,
  "error": "NO_ROUTES_FOUND",
  "message": "No routes found from VNSGN to USNYC with given constraints",
  "metadata": {
    "origin": "VNSGN",
    "destination": "USNYC",
    "constraints": {
      "max_transit_stops": 0,
      "max_alarm_rate": 0.01
    }
  }
}
```

## Response Fields Explained

### Route Object

| Field | Type | Description |
|-------|------|-------------|
| `rank` | integer | Thứ hạng của route (1 = tốt nhất) |
| `path` | array | Danh sách các cảng theo thứ tự |
| `legs` | array | Chi tiết từng chặng đi |
| `summary` | object | Tổng hợp thông tin route |
| `recommendation` | string | Mức độ khuyến nghị |

### Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `total_stops` | integer | Tổng số trạm dừng |
| `total_hours` | float | Tổng thời gian di chuyển (giờ) |
| `total_distance_km` | integer | Tổng quãng đường (km) |
| `avg_alarm_rate` | float | Tỷ lệ alarm trung bình (0-1) |
| `max_alarm_rate` | float | Tỷ lệ alarm cao nhất (0-1) |
| `route_types` | array | Các loại vận chuyển sử dụng |
| `optimization_score` | float | Điểm tối ưu (thấp hơn = tốt hơn) |

### Recommendation Levels

| Level | Criteria | Description |
|-------|----------|-------------|
| `HIGHLY_RECOMMENDED` | alarm_rate < 5% AND stops ≤ 1 | Route xuất sắc, rất an toàn |
| `RECOMMENDED` | alarm_rate < 8% AND stops ≤ 2 | Route tốt, đáng tin cậy |
| `ACCEPTABLE` | alarm_rate < 10% | Route chấp nhận được |
| `USE_WITH_CAUTION` | alarm_rate ≥ 10% | Cần giám sát chặt chẽ |

## Algorithm Details

### 1. Graph Representation

- **Nodes**: Ports (VNSGN, SGSIN, HKHKG, USNYC, etc.)
- **Edges**: port_edges collection (from_port → to_port)
- **Weights**: 
  - Primary: avg_hours (transit time)
  - Secondary: alarm_rate (risk factor)

### 2. $graphLookup Mechanics

```javascript
{
  $graphLookup: {
    from: 'port_edges',
    startWith: '$to_port',
    connectFromField: 'to_port',
    connectToField: 'from_port',
    as: 'possible_routes',
    maxDepth: maxTransitStops,
    depthField: 'transit_stop',
    restrictSearchWithMatch: {
      alarm_rate: { $lt: maxAlarmRate },
      is_active: true
    }
  }
}
```

### 3. Path Reconstruction

- Input: Flattened array từ $graphLookup với depthField
- Process: Backtracking từ destination về origin
- Output: Complete paths với total cost calculation

### 4. Optimization Criteria

**Optimization Score Formula:**

```
score = (0.5 × normalized_time) + (0.3 × alarm_rate) + (0.2 × normalized_stops)
```

- **50% weight**: Transit time (nhanh hơn = tốt hơn)
- **30% weight**: Risk level (an toàn hơn = tốt hơn)
- **20% weight**: Number of stops (ít hơn = tốt hơn)

## Use Cases

### 1. Vaccine Shipment (Cold Chain)

**Requirements:**
- Thời gian ngắn nhất (< 72 giờ)
- An toàn cao (alarm_rate < 5%)
- Ít trạm dừng (≤ 2)

**Request:**
```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.05&maxTransitStops=2&maxRoutes=3
```

### 2. Electronics Shipment

**Requirements:**
- Tránh độ ẩm cao
- Giảm thiểu handling
- Có bảo hiểm

**Request:**
```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxAlarmRate=0.08&maxTransitStops=2
```

### 3. Standard Cargo

**Requirements:**
- Cân bằng giữa thời gian và chi phí
- Chấp nhận nhiều trạm dừng hơn

**Request:**
```bash
GET /api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC&maxTransitStops=3
```

## Performance Considerations

### Index Strategy

```javascript
// Required indexes on port_edges collection
{ from_port: 1, to_port: 1 }  // Unique index
{ alarm_rate: -1 }             // Filter index
{ avg_hours: 1 }               // Sort index
{ route_type: 1 }              // Filter index
{ is_active: 1 }               // Filter index
```

### Optimization Tips

1. **Limit maxTransitStops**: Giảm độ sâu tìm kiếm
2. **Use routeType filter**: Giảm số edges cần xét
3. **Cache popular routes**: Lưu kết quả cho các cặp cảng phổ biến
4. **Pre-compute routes**: Tính trước cho các tuyến chính

### Expected Performance

- **Small graphs** (< 100 edges): < 100ms
- **Medium graphs** (100-1000 edges): 100-500ms
- **Large graphs** (> 1000 edges): 500-2000ms

## Testing

### Unit Tests

```bash
# Run aggregation tests
node src/database/test/test_route_optimization.js
```

### API Integration Tests

```bash
# Run API tests (requires server running)
node src/test/test_route_optimization_api.js

# Run specific test
node src/test/test_route_optimization_api.js basic
node src/test/test_route_optimization_api.js strict
node src/test/test_route_optimization_api.js errors
```

### Postman Collection

Import `src/test/RouteOptimization_Postman_Collection.json` vào Postman để test thủ công.

## Data Requirements

### port_edges Collection Schema

```javascript
{
  from_port: String,        // Mã cảng xuất phát
  to_port: String,          // Mã cảng đích
  route_type: String,       // SEA, AIR, LAND, MULTIMODAL
  distance_km: Number,      // Khoảng cách (km)
  avg_hours: Number,        // Thời gian trung bình (giờ)
  min_hours: Number,        // Thời gian tối thiểu
  max_hours: Number,        // Thời gian tối đa
  std_dev_hours: Number,    // Độ lệch chuẩn
  samples: Number,          // Số mẫu thống kê
  alarm_rate: Number,       // Tỷ lệ cảnh báo (0-1)
  last_updated: Date,       // Cập nhật lần cuối
  is_active: Boolean        // Trạng thái hoạt động
}
```

### Sample Data Generation

```bash
# Generate test data
node src/database/test/test_route_optimization.js
```

## Error Handling

### Client-Side Validation

```javascript
// Validate before calling API
if (!origin || !destination) {
  throw new Error('Origin and destination are required');
}

if (origin === destination) {
  throw new Error('Origin and destination must be different');
}

if (maxAlarmRate < 0 || maxAlarmRate > 1) {
  throw new Error('maxAlarmRate must be between 0 and 1');
}
```

### Server-Side Error Handling

- Parameter validation
- Port existence check
- Graph traversal timeout (30s)
- Memory limits (allowDiskUse: true)

## Security Considerations

1. **Input Validation**: Tất cả parameters được validate
2. **SQL Injection**: Không áp dụng (MongoDB)
3. **Rate Limiting**: Nên implement để tránh abuse
4. **Authentication**: Có thể thêm JWT middleware nếu cần

## Future Enhancements

1. **Real-time Updates**: WebSocket cho route changes
2. **Machine Learning**: Predict delays và risks
3. **Weather Integration**: Factor in weather conditions
4. **Cost Optimization**: Add shipping cost as factor
5. **Multi-modal Routing**: Optimize across transport types
6. **Route Caching**: Redis cache for popular routes
7. **Historical Analysis**: Trend analysis over time

## Related APIs

- **API 5.1**: Trace Route - Truy vết hành trình thực tế
- **API 3.1**: Chain of Custody - Theo dõi quyền sở hữu
- **API 2.1**: Telemetry Ingestion - Thu thập dữ liệu IoT

## Support

For issues or questions:
- Check logs: `console.log` statements in code
- Run tests: `npm test`
- Review documentation: This file
- Contact: Development team
