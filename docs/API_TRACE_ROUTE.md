# API 5.1: Trace Route (Truy vết hành trình)

## Tổng quan

API này cho phép truy vết hành trình thực tế của container dựa trên dữ liệu telemetry từ IoT sensors. Kết quả trả về dưới dạng GeoJSON FeatureCollection để dễ dàng hiển thị trên bản đồ.

## Endpoint

```
GET /api/v1/analytics/trace-route/:shipmentId
```

## Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shipmentId | string | Yes | ID của shipment cần truy vết |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| maxPoints | integer | No | 1000 | Số điểm tối đa trả về (1-10000) |

## Request Example

```bash
# Basic request
curl -X GET "http://localhost:3000/api/v1/analytics/trace-route/SH001"

# With maxPoints parameter
curl -X GET "http://localhost:3000/api/v1/analytics/trace-route/SH001?maxPoints=500"
```

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "type": "FeatureCollection",
    "metadata": {
      "shipment_id": "SH001",
      "total_points_in_db": 5000,
      "returned_points": 1000,
      "sampling_ratio": 5,
      "data_reduction_pct": "80.00",
      "temp_threshold": 25,
      "violation_count": 150,
      "violation_rate": "15.00%",
      "temp_statistics": {
        "min": 18.5,
        "max": 32.8,
        "avg": "24.35"
      },
      "route_statistics": {
        "total_distance_km": "1250.45",
        "duration_hours": "48.50",
        "avg_speed_kmh": "25.78",
        "start_time": "2026-03-15T08:00:00.000Z",
        "end_time": "2026-03-17T08:30:00.000Z"
      },
      "shipment_details": {
        "shipment_id": "SH001",
        "cargo_profile_id": "CP001",
        "origin_port": "SGSIN",
        "destination_port": "USNYC",
        "current_status": "IN_TRANSIT",
        "current_location": "HKHKG",
        "weight_kg": 15000
      },
      "cargo_constraints": {
        "temp_min": 15,
        "temp_max": 25,
        "humidity_min": 40,
        "humidity_max": 70,
        "max_transit_hours": 168
      },
      "execution_time_ms": 245,
      "query_efficiency": "20.41 points/ms",
      "generated_at": "2026-03-21T10:30:00.000Z",
      "data_quality": {
        "completeness": "COMPLETE",
        "freshness": "AVAILABLE",
        "sampling_method": "DOWNSAMPLED"
      }
    },
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [103.8198, 1.3521]
        },
        "properties": {
          "timestamp": "2026-03-15T08:00:00.000Z",
          "temp": 22.5,
          "humidity": 65,
          "device_id": "IOT-001",
          "is_violation": false,
          "temp_delta": -2.5,
          "violation_severity": null
        }
      },
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [104.1234, 1.4567]
        },
        "properties": {
          "timestamp": "2026-03-15T09:00:00.000Z",
          "temp": 28.3,
          "humidity": 68,
          "device_id": "IOT-001",
          "is_violation": true,
          "temp_delta": 3.3,
          "violation_severity": "HIGH"
        }
      }
    ]
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Parameters

```json
{
  "success": false,
  "error": "shipmentId is required"
}
```

```json
{
  "success": false,
  "error": "maxPoints must be between 1 and 10000"
}
```

#### 404 Not Found - Shipment không tồn tại

```json
{
  "success": false,
  "error": "Shipment not found: INVALID_ID"
}
```

#### 404 Not Found - Không có telemetry data

```json
{
  "success": false,
  "error": "No telemetry data available for shipment: SH001"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to trace route: Database connection error"
}
```

## Response Fields Description

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| shipment_id | string | ID của shipment |
| total_points_in_db | integer | Tổng số điểm telemetry trong database |
| returned_points | integer | Số điểm thực tế trả về (sau downsampling) |
| sampling_ratio | integer | Tỷ lệ lấy mẫu (1 = full data, 5 = lấy 1/5) |
| data_reduction_pct | string | Phần trăm dữ liệu bị giảm do downsampling |
| temp_threshold | number | Ngưỡng nhiệt độ tối đa từ CargoProfile |
| violation_count | integer | Số điểm vi phạm nhiệt độ |
| violation_rate | string | Tỷ lệ vi phạm (%) |
| temp_statistics | object | Thống kê nhiệt độ (min, max, avg) |
| route_statistics | object | Thống kê hành trình (distance, duration, speed) |
| shipment_details | object | Thông tin chi tiết shipment |
| cargo_constraints | object | Ràng buộc từ CargoProfile |
| execution_time_ms | integer | Thời gian thực thi query (ms) |
| query_efficiency | string | Hiệu suất query (points/ms) |
| generated_at | string | Thời điểm tạo response (ISO 8601) |
| data_quality | object | Chỉ số chất lượng dữ liệu |

### Feature Properties

| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | Thời điểm đo (ISO 8601) |
| temp | number | Nhiệt độ (°C) |
| humidity | number | Độ ẩm (%) |
| device_id | string | ID của IoT device |
| is_violation | boolean | Có vi phạm nhiệt độ không |
| temp_delta | number | Độ lệch so với threshold (°C) |
| violation_severity | string | Mức độ vi phạm: WARNING, HIGH, CRITICAL |

### Violation Severity Levels

| Level | Condition | Description |
|-------|-----------|-------------|
| null | temp <= threshold | Không vi phạm |
| WARNING | threshold < temp < threshold + 2 | Vi phạm nhẹ |
| HIGH | threshold + 2 <= temp < threshold + 5 | Vi phạm cao |
| CRITICAL | temp >= threshold + 5 | Vi phạm nghiêm trọng |

## Technical Implementation

### Database Collections

1. **MongoDB - telemetry_points** (Time-series collection)
   - Lưu trữ dữ liệu telemetry từ IoT sensors
   - Index: `{ "meta.shipment_id": 1, "t": 1 }` (compound index)
   - Index: `{ "location": "2dsphere" }` (geospatial index)

2. **MySQL - Shipments & CargoProfiles**
   - Lấy thông tin shipment và temp threshold

### Aggregation Pipeline

Pipeline gồm 6 stages chính:

1. **$match**: Filter theo shipment_id
2. **$sort**: Sắp xếp theo timestamp
3. **$setWindowFields**: Thêm row number cho downsampling
4. **$match**: Downsampling filter (modulo-based)
5. **$addFields**: Detect violations
6. **$project**: Transform to GeoJSON Feature

### Performance Optimizations

1. **Index Strategy**
   - Compound index cho filter + sort
   - 2dsphere index cho geospatial queries
   - Time-series collection với metaField optimization

2. **Downsampling**
   - Adaptive sampling dựa trên data volume
   - Modulo-based algorithm (deterministic)
   - Giảm data transfer và rendering load

3. **Query Options**
   - `allowDiskUse: true` cho large datasets
   - `maxTimeMS: 30000` timeout protection
   - Streaming results với cursor

### Distance Calculation

Sử dụng Haversine formula để tính khoảng cách giữa các điểm:

```javascript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

## Use Cases

### 1. Visualize Route on Map

```javascript
// Frontend code với Leaflet.js
fetch('/api/v1/analytics/trace-route/SH001')
  .then(res => res.json())
  .then(data => {
    const geojson = data.data;
    
    // Add to map
    L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const color = feature.properties.is_violation ? 'red' : 'green';
        return L.circleMarker(latlng, { color, radius: 5 });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        layer.bindPopup(`
          <b>Time:</b> ${props.timestamp}<br>
          <b>Temp:</b> ${props.temp}°C<br>
          <b>Humidity:</b> ${props.humidity}%<br>
          <b>Violation:</b> ${props.violation_severity || 'None'}
        `);
      }
    }).addTo(map);
  });
```

### 2. Temperature Chart

```javascript
// Frontend code với Chart.js
fetch('/api/v1/analytics/trace-route/SH001')
  .then(res => res.json())
  .then(data => {
    const features = data.data.features;
    const threshold = data.data.metadata.temp_threshold;
    
    const chartData = {
      labels: features.map(f => new Date(f.properties.timestamp)),
      datasets: [
        {
          label: 'Temperature',
          data: features.map(f => f.properties.temp),
          borderColor: 'blue'
        },
        {
          label: 'Threshold',
          data: Array(features.length).fill(threshold),
          borderColor: 'red',
          borderDash: [5, 5]
        }
      ]
    };
    
    new Chart(ctx, { type: 'line', data: chartData });
  });
```

### 3. Violation Report

```javascript
// Generate violation report
fetch('/api/v1/analytics/trace-route/SH001')
  .then(res => res.json())
  .then(data => {
    const metadata = data.data.metadata;
    const violations = data.data.features.filter(f => f.properties.is_violation);
    
    console.log(`Violation Report for ${metadata.shipment_id}`);
    console.log(`Total Points: ${metadata.returned_points}`);
    console.log(`Violations: ${metadata.violation_count} (${metadata.violation_rate})`);
    console.log(`Temperature Range: ${metadata.temp_statistics.min}°C - ${metadata.temp_statistics.max}°C`);
    
    violations.forEach(v => {
      console.log(`- ${v.properties.timestamp}: ${v.properties.temp}°C (${v.properties.violation_severity})`);
    });
  });
```

## Testing

### Manual Testing

```bash
# Run test suite
cd src/test
node test_trace_route_api.js

# Test specific shipment
node test_trace_route_api.js --shipment SH001

# Test with maxPoints
node test_trace_route_api.js --shipment SH001 --maxPoints 500

# Performance test
node test_trace_route_api.js --performance
```

### Expected Performance

| Data Volume | maxPoints | Response Time | Throughput |
|-------------|-----------|---------------|------------|
| 1,000 points | 1000 | < 100ms | > 10 points/ms |
| 5,000 points | 1000 | < 300ms | > 15 points/ms |
| 10,000 points | 1000 | < 500ms | > 20 points/ms |
| 50,000 points | 1000 | < 1000ms | > 50 points/ms |

## Best Practices

### For API Consumers

1. **Use maxPoints wisely**
   - Map visualization: 500-1000 points
   - Detailed analysis: 2000-5000 points
   - Export/reporting: Full data

2. **Cache results**
   - Cache completed shipments
   - TTL: 5-10 minutes for in-transit shipments

3. **Handle errors gracefully**
   - Check `success` field
   - Display user-friendly error messages
   - Retry on 500 errors with exponential backoff

### For Backend Developers

1. **Monitor performance**
   - Track `execution_time_ms` in logs
   - Alert on queries > 1000ms
   - Use MongoDB profiler

2. **Optimize indexes**
   - Ensure compound index exists
   - Monitor index usage with `explain()`
   - Consider sharding for large datasets

3. **Handle edge cases**
   - Empty telemetry data
   - Single point routes
   - Very large datasets (> 100k points)

## Troubleshooting

### Slow Queries

1. Check index usage:
```javascript
db.telemetry_points.find({ "meta.shipment_id": "SH001" })
  .sort({ t: 1 })
  .explain("executionStats")
```

2. Verify index exists:
```javascript
db.telemetry_points.getIndexes()
```

3. Create missing index:
```javascript
db.telemetry_points.createIndex({ "meta.shipment_id": 1, "t": 1 })
```

### No Data Returned

1. Check shipment exists in MySQL
2. Verify telemetry data in MongoDB
3. Check shipment_id format (case-sensitive)

### Memory Issues

1. Reduce maxPoints parameter
2. Enable `allowDiskUse: true` in aggregation
3. Consider pagination for very large datasets

## Related APIs

- **API 5.2**: Route Optimization (Tối ưu hành trình)
- **API 3.1**: Chain of Custody (Chuỗi sở hữu)
- **API 4.1**: Ingest Telemetry (Nhận dữ liệu telemetry)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-21 | Initial implementation |
