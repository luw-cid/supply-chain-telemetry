# Global Supply Chain & Asset Telemetry System

Hệ thống quản lý chuỗi cung ứng toàn cầu với tính năng theo dõi telemetry, tối ưu hóa lộ trình và quản lý chuỗi sở hữu.

## Tính năng chính

### 1. Telemetry Ingestion (API 2.1)
- Thu thập dữ liệu từ IoT devices
- Lưu trữ vào MongoDB (telemetry_logs, telemetry_points)
- Phát hiện vi phạm nhiệt độ/độ ẩm
- Saga orchestration pattern

### 2. Chain of Custody (API 3.1 & 3.2)
- Theo dõi quyền sở hữu lô hàng
- Chuyển giao custody giữa các bên
- Recursive CTE trong MySQL
- Audit trail đầy đủ

### 3. Trace Route (API 5.1)
- Truy vết hành trình thực tế của shipment
- Aggregation pipeline phức tạp
- GeoJSON output cho mapping
- Phân tích độ lệch so với kế hoạch

### 4. Route Optimization (API 5.2) ⭐ NEW
- Tìm lộ trình tối ưu giữa 2 cảng
- Graph traversal với MongoDB $graphLookup
- Tính toán dựa trên dữ liệu lịch sử
- Lọc theo alarm rate và transit stops

## API Endpoints

### Analytics APIs

#### GET /api/v1/analytics/trace-route/:shipmentId
Truy vết hành trình thực tế của shipment

**Parameters:**
- `shipmentId` (path): ID của shipment
- `maxPoints` (query): Số điểm tối đa (default: 1000)

**Response:** GeoJSON FeatureCollection

**Documentation:** [docs/API_TRACE_ROUTE.md](docs/API_TRACE_ROUTE.md)

#### GET /api/v1/analytics/route-optimization
Tìm lộ trình tối ưu giữa 2 cảng

**Parameters:**
- `origin` (required): Mã cảng xuất phát
- `destination` (required): Mã cảng đích
- `maxTransitStops` (optional): Số trạm dừng tối đa (default: 3)
- `maxAlarmRate` (optional): Tỷ lệ alarm tối đa (default: 0.1)
- `maxRoutes` (optional): Số routes trả về (default: 5)
- `routeType` (optional): Loại vận chuyển (SEA, AIR, LAND, MULTIMODAL)

**Response:** Danh sách routes được rank theo độ tối ưu

**Documentation:** [docs/API_ROUTE_OPTIMIZATION.md](docs/API_ROUTE_OPTIMIZATION.md)

### Chain of Custody APIs

#### POST /api/v1/shipments/:shipmentId/custody/transfer
Chuyển giao quyền sở hữu

#### GET /api/v1/shipments/:shipmentId/custody/chain
Lấy chuỗi sở hữu đầy đủ

**Documentation:** [docs/chain_of_custody_api.md](docs/chain_of_custody_api.md)

### Telemetry APIs

#### POST /api/telemetry
Nhận dữ liệu telemetry từ IoT devices

## Tech Stack

### Backend
- **Node.js** + Express.js
- **MySQL** - Transactional data (shipments, custody, violations)
- **MongoDB** - Time-series data (telemetry, routes, analytics)

### Key Technologies
- **MongoDB Aggregation Pipeline** - Complex analytics
- **$graphLookup** - Graph traversal for route optimization
- **Recursive CTE** - Chain of custody tracking
- **Saga Pattern** - Distributed transactions
- **GeoJSON** - Geographic data format

## Project Structure

```
src/
├── app.js                          # Express app setup
├── configs/                        # Database configurations
│   ├── mongodb.config.js
│   ├── sql.config.js
│   └── migration.js
├── controllers/                    # Request handlers
│   ├── telemetry.controller.js    # Telemetry & Analytics APIs
│   ├── custody.controller.js      # Chain of Custody APIs
│   └── shipment.controller.js
├── services/                       # Business logic
│   ├── trace_route.service.js
│   ├── route_optimization.service.js
│   ├── custody.service.js
│   └── saga-orchestrator.js
├── database/
│   ├── mongo/                      # MongoDB aggregations
│   │   ├── trace_route_aggregation.js
│   │   └── route_optimization_aggregation.js
│   ├── sql/                        # MySQL stored procedures
│   │   ├── sp_trace_route_context.sql
│   │   └── sp_change_custody.sql
│   └── test/                       # Test data & scripts
├── models/
│   └── mongodb/                    # Mongoose schemas
│       ├── telemetry_logs.js
│       ├── telemetry_points.js
│       ├── port_edges.js
│       └── shipment_routes.js
├── routes/                         # API routes
│   ├── telemetry.route.js
│   ├── custody.route.js
│   └── shipment.route.js
└── test/                           # API tests
    ├── test_trace_route_api.js
    ├── test_route_optimization_api.js
    └── *.json                      # Postman collections

docs/
├── API_TRACE_ROUTE.md              # Trace Route documentation
├── API_ROUTE_OPTIMIZATION.md       # Route Optimization documentation
├── chain_of_custody_api.md         # Chain of Custody documentation
├── design.md                       # System design
└── ROUTE_OPTIMIZATION_TECHNICAL_GUIDE.md
```

## Installation

### Prerequisites
- Node.js >= 14.x
- MySQL >= 8.0
- MongoDB >= 4.4

### Setup

1. Clone repository
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies
```bash
cd src
npm install
```

3. Configure environment
```bash
cp src/.env.example src/.env
# Edit .env with your database credentials
```

4. Setup databases
```bash
# MySQL
mysql -u root -p < src/configs/mysql.sql

# MongoDB indexes
node src/database/mongo/create_indexes.js
```

5. Run migrations (if needed)
```bash
node src/configs/migration.js
```

## Running the Application

### Development Mode
```bash
cd src
npm start
```

Server will start on `http://localhost:3000`

### Production Mode
```bash
cd src
NODE_ENV=production npm start
```

## Testing

### Unit Tests

#### Route Optimization
```bash
# Test aggregation pipeline
node src/database/test/test_route_optimization.js

# Test specific functions
node src/database/test/test_route_optimization.js basic
```

#### Trace Route
```bash
node src/database/test/test_trace_route_aggregation.js
```

### API Integration Tests

#### Route Optimization API
```bash
# Ensure server is running first
npm start

# In another terminal
node src/test/test_route_optimization_api.js

# Run specific test
node src/test/test_route_optimization_api.js basic
node src/test/test_route_optimization_api.js strict
node src/test/test_route_optimization_api.js errors
```

#### Trace Route API
```bash
node src/test/test_trace_route_api.js
```

### Postman Collections

Import these collections into Postman:
- `src/test/RouteOptimization_Postman_Collection.json`
- `src/test/TraceRoute_Postman_Collection.json`
- `src/test/ChainOfCustody_Postman_Collection.json`

## Database Schemas

### MySQL Tables
- `Shipments` - Thông tin lô hàng
- `Ports` - Danh sách cảng
- `Custody_History` - Lịch sử chuyển giao
- `Violations` - Vi phạm nhiệt độ/độ ẩm
- `Outbox_Events` - Event sourcing

### MongoDB Collections
- `telemetry_logs` - Raw telemetry data
- `telemetry_points` - Processed GPS points
- `port_edges` - Statistical data về routes giữa các cảng
- `shipment_routes` - Planned routes

## Key Features Explained

### Route Optimization Algorithm

**Problem:** Tìm lộ trình tối ưu từ cảng A đến cảng B

**Solution:** MongoDB $graphLookup + Path Reconstruction

**Steps:**
1. Graph traversal từ origin port
2. Filter edges theo alarm_rate và constraints
3. Reconstruct complete paths từ flattened array
4. Calculate optimization score
5. Rank và return top routes

**Optimization Score:**
```
score = 0.5 × normalized_time + 0.3 × alarm_rate + 0.2 × normalized_stops
```

**Use Cases:**
- Vaccine shipment (strict safety, minimal stops)
- Electronics (humidity control, careful handling)
- Standard cargo (balance time and cost)

### Trace Route Analytics

**Problem:** Truy vết hành trình thực tế và so sánh với kế hoạch

**Solution:** MongoDB Aggregation Pipeline

**Features:**
- GeoJSON output cho visualization
- Phân tích độ lệch (deviation analysis)
- Violation detection
- ETA calculation

### Chain of Custody

**Problem:** Theo dõi quyền sở hữu qua nhiều bên

**Solution:** MySQL Recursive CTE

**Features:**
- Complete audit trail
- Transfer validation
- Historical tracking
- Compliance reporting

## Performance Optimization

### MongoDB Indexes
```javascript
// port_edges collection
{ from_port: 1, to_port: 1 }  // Unique
{ alarm_rate: -1 }
{ avg_hours: 1 }
{ route_type: 1 }
{ is_active: 1 }

// telemetry_points collection
{ shipment_id: 1, timestamp: 1 }
{ location: "2dsphere" }
```

### Query Optimization
- Use `allowDiskUse: true` for large aggregations
- Set `maxTimeMS` to prevent long-running queries
- Implement caching for popular routes
- Pre-compute common analytics

## API Response Times

| Endpoint | Expected Time | Notes |
|----------|--------------|-------|
| Route Optimization | 100-500ms | Depends on graph size |
| Trace Route | 200-800ms | Depends on telemetry points |
| Chain of Custody | 50-200ms | MySQL recursive query |
| Telemetry Ingestion | 50-150ms | Async processing |

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=supply_chain

# MongoDB
MONGO_URI=mongodb://localhost:27017/supply_chain
MONGO_DB_NAME=supply_chain

# JWT (if authentication enabled)
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh

# Check connection string in .env
MONGO_URI=mongodb://localhost:27017/supply_chain
```

### MySQL Connection Issues
```bash
# Check MySQL is running
mysql -u root -p

# Verify credentials in .env
```

### No Routes Found
```bash
# Generate test data
node src/database/test/test_route_optimization.js

# Check port_edges collection
mongosh
use supply_chain
db.port_edges.find().pretty()
```

### API Returns 404
```bash
# Check server is running
curl http://localhost:3000/api/v1/analytics/route-optimization?origin=VNSGN&destination=USNYC

# Check routes are registered
# Look for route registration in src/routes/
```

## Contributing

1. Create feature branch
2. Make changes
3. Write tests
4. Update documentation
5. Submit pull request

## License

[Your License Here]

## Contact

For questions or support, contact the development team.
