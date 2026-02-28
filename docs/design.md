# Design Document

## Overview

Tài liệu này mô tả thiết kế chi tiết cho việc cải tiến hệ thống hybrid database của dự án Global Supply Chain & Asset Telemetry. Thiết kế tập trung vào việc nâng cao chất lượng schema, thêm automation thông qua triggers và stored procedures, tối ưu hóa performance thông qua indexes và views, và đảm bảo data integrity thông qua validation và synchronization mechanisms.

Hệ thống sử dụng kiến trúc hybrid với MySQL cho structured transactional data và MongoDB cho time-series IoT data. Thiết kế này đảm bảo cả hai databases hoạt động hiệu quả và đồng bộ với nhau.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │  Sync Service │  │ Change Stream│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    MySQL     │◄────►│ Sync Layer   │◄────►│   MongoDB    │
│              │      │              │      │              │
│ • Shipments  │      │ • Validation │      │ • Telemetry  │
│ • Ownership  │      │ • Transform  │      │ • Routes     │
│ • Alarms     │      │ • Retry      │      │ • Logs       │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Database Layer Architecture

**MySQL Layer:**
- Tables: Parties, Ports, CargoProfiles, Shipments, Ownership, AlarmEvents, AuditLog
- Triggers: Auto-create alarms, validate ownership, update timestamps
- Stored Procedures: Business logic for transfers, validations, queries
- Views: Pre-joined data for common queries

**MongoDB Layer:**
- Collections: telemetry_points (time-series), shipment_routes, port_edges, telemetry_logs
- Indexes: Geospatial (2dsphere), compound, TTL
- Change Streams: Real-time monitoring and alerting
- Aggregation Pipelines: Analytics and reporting

**Sync Layer:**
- Bidirectional sync between MySQL and MongoDB
- Event-driven architecture using Change Streams
- Retry mechanism with exponential backoff
- Validation layer for referential integrity



## Components and Interfaces

### 1. MySQL Schema Enhancements

#### 1.1 Enhanced Parties Table

```sql
-- Bảng lưu trữ thông tin các bên liên quan trong chuỗi cung ứng
CREATE TABLE Parties (
    -- Primary identifier cho party (có thể là company ID, tax ID, etc.)
    PartyID       VARCHAR(32)   NOT NULL,
    
    -- Loại bên liên quan: OWNER (chủ hàng), LOGISTICS (vận chuyển), AUDITOR (kiểm toán)
    PartyType     ENUM('OWNER','LOGISTICS','AUDITOR') NOT NULL,
    
    -- Tên công ty hoặc tổ chức
    Name          VARCHAR(255)  NOT NULL,
    
    -- Email liên hệ chính - dùng cho notifications và communications
    Email         VARCHAR(255)  NULL,
    
    -- Số điện thoại liên hệ - format quốc tế (+country_code)
    Phone         VARCHAR(32)   NULL,
    
    -- Địa chỉ đầy đủ của công ty - dùng TEXT để lưu multi-line address
    Address       TEXT          NULL,
    
    -- Trạng thái hoạt động: ACTIVE (đang hoạt động), INACTIVE (tạm ngưng), SUSPENDED (bị đình chỉ)
    Status        ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    
    -- Timestamp khi record được tạo - dùng cho audit trail
    CreatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- Timestamp khi record được update lần cuối - tự động update
    UpdatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    
    PRIMARY KEY (PartyID),
    
    -- Index để query nhanh parties theo type và status (e.g., all active logistics providers)
    INDEX idx_party_type_status (PartyType, Status),
    
    -- Index để search by email
    INDEX idx_party_email (Email)
) ENGINE=InnoDB;
```

#### 1.2 Enhanced Ports Table

```sql
-- Bảng lưu trữ thông tin các cảng biển/sân bay
CREATE TABLE Ports (
    -- Mã cảng theo chuẩn UN/LOCODE (e.g., VNSGN for Saigon Port)
    PortCode  VARCHAR(16)   NOT NULL,
    
    -- Tên đầy đủ của cảng
    Name      VARCHAR(255)  NOT NULL,
    
    -- Quốc gia nơi cảng tọa lạc
    Country   VARCHAR(128)  NOT NULL,
    
    -- Vĩ độ - dùng DECIMAL(10,8) cho độ chính xác cao (±90 degrees, 8 decimal places)
    -- Ví dụ: 10.76245678 (Saigon)
    Latitude  DECIMAL(10,8) NULL,
    
    -- Kinh độ - dùng DECIMAL(11,8) cho độ chính xác cao (±180 degrees, 8 decimal places)
    -- Ví dụ: 106.68234567 (Saigon)
    Longitude DECIMAL(11,8) NULL,
    
    -- IANA timezone identifier (e.g., 'Asia/Ho_Chi_Minh') - dùng cho scheduling
    Timezone  VARCHAR(64)   NULL,
    
    -- Trạng thái hoạt động: OPERATIONAL (hoạt động bình thường), CLOSED (đóng cửa), RESTRICTED (hạn chế)
    Status    ENUM('OPERATIONAL','CLOSED','RESTRICTED') NOT NULL DEFAULT 'OPERATIONAL',
    
    PRIMARY KEY (PortCode),
    
    -- Index để query ports by country
    INDEX idx_port_country (Country),
    
    -- Composite index cho geospatial queries (find nearby ports)
    INDEX idx_port_location (Latitude, Longitude),
    
    -- Index để filter by status
    INDEX idx_port_status (Status)
) ENGINE=InnoDB;
```



#### 1.3 Enhanced CargoProfiles Table

```sql
-- Bảng định nghĩa điều kiện vận chuyển cho từng loại hàng hóa
CREATE TABLE CargoProfiles (
    -- Loại hàng hóa: VACCINE, FROZEN_FOOD, PHARMA, OTHER
    CargoType  VARCHAR(32)    NOT NULL,
    
    -- Nhiệt độ tối thiểu cho phép (Celsius) - dùng DECIMAL(6,2) cho precision
    -- Ví dụ: -80.00 cho COVID vaccine
    TempMin    DECIMAL(6,2)   NOT NULL,
    
    -- Nhiệt độ tối đa cho phép (Celsius)
    -- Ví dụ: -60.00 cho COVID vaccine
    TempMax    DECIMAL(6,2)   NOT NULL,
    
    -- Độ ẩm tối thiểu cho phép (%) - NULL nếu không yêu cầu
    HumidityMin DECIMAL(5,2)  NULL,
    
    -- Độ ẩm tối đa cho phép (%) - NULL nếu không yêu cầu
    -- Ví dụ: 60.00% cho một số loại dược phẩm
    HumidityMax DECIMAL(5,2)  NULL,
    
    -- Thời gian vận chuyển tối đa cho phép (giờ) - NULL nếu không giới hạn
    -- Ví dụ: 72 giờ cho vaccine cần giao nhanh
    MaxTransitHours INT        NULL,
    
    -- Hướng dẫn xử lý hàng hóa - TEXT để lưu instructions chi tiết
    -- Ví dụ: "Keep upright. Do not shake. Protect from light."
    HandlingInstructions TEXT  NULL,
    
    -- Flag cho biết hàng có cần làm lạnh không - dùng cho routing decisions
    RequiresRefrigeration BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- UN hazardous classification (e.g., "UN2814" for infectious substances)
    -- NULL nếu không phải hàng nguy hiểm
    HazardousClass VARCHAR(16) NULL,
    
    PRIMARY KEY (CargoType),
    
    -- Constraint đảm bảo TempMin < TempMax
    CONSTRAINT chk_cargo_temp CHECK (TempMin < TempMax),
    
    -- Constraint đảm bảo HumidityMin < HumidityMax nếu cả hai đều có giá trị
    CONSTRAINT chk_cargo_humidity CHECK (
        HumidityMin IS NULL OR 
        HumidityMax IS NULL OR 
        HumidityMin < HumidityMax
    ),
    
    -- Constraint giới hạn CargoType values
    CONSTRAINT chk_cargo_type CHECK (
        CargoType IN ('VACCINE','FROZEN_FOOD','PHARMA','OTHER')
    ),
    
    -- Index để query by refrigeration requirement
    INDEX idx_cargo_refrigeration (RequiresRefrigeration)
) ENGINE=InnoDB;
```

#### 1.4 Enhanced Shipments Table

```sql
-- Bảng trung tâm lưu trữ thông tin lô hàng
CREATE TABLE Shipments (
    -- Unique identifier cho shipment (e.g., "SHP-2024-001234")
    ShipmentID          VARCHAR(32)   NOT NULL,
    
    -- Loại hàng hóa - FK to CargoProfiles để enforce valid cargo types
    CargoType           VARCHAR(32)   NOT NULL,
    
    -- Trọng lượng hàng hóa (kg) - dùng DECIMAL(10,2) cho precision
    WeightKg            DECIMAL(10,2) NOT NULL,
    
    -- Thể tích hàng hóa (m³) - dùng cho capacity planning
    VolumeM3            DECIMAL(10,2) NULL,
    
    -- Party ID của người gửi hàng - FK to Parties
    ShipperPartyID      VARCHAR(32)   NOT NULL,
    
    -- Party ID của người nhận hàng - FK to Parties
    ConsigneePartyID    VARCHAR(32)   NOT NULL,
    
    -- Cảng xuất phát - FK to Ports
    OriginPortCode      VARCHAR(16)   NOT NULL,
    
    -- Cảng đích - FK to Ports
    DestinationPortCode VARCHAR(16)   NOT NULL,
    
    -- Trạng thái hiện tại: NORMAL, IN_TRANSIT, ALARM, COMPLETED
    Status              ENUM('NORMAL','IN_TRANSIT','ALARM','COMPLETED') NOT NULL,
    
    -- Mô tả vị trí hiện tại (text) - deprecated, dùng CurrentPortCode thay thế
    CurrentLocation     VARCHAR(255)  NULL,
    
    -- Cảng hiện tại - FK to Ports, NULL nếu đang trên đường
    CurrentPortCode     VARCHAR(16)   NULL,
    
    -- Thời gian dự kiến đến - dùng cho tracking và alerting
    EstimatedArrivalUTC TIMESTAMP(6)  NULL,
    
    -- Thời gian thực tế đến - NULL cho đến khi hoàn thành
    ActualArrivalUTC    TIMESTAMP(6)  NULL,
    
    -- Giá trị bảo hiểm - dùng DECIMAL(15,2) cho large amounts
    InsuranceValue      DECIMAL(15,2) NULL,
    
    -- Mã tiền tệ theo ISO 4217 (e.g., "USD", "EUR", "VND")
    Currency            VARCHAR(3)    NULL DEFAULT 'USD',
    
    -- ID của thiết bị IoT tracking - dùng để link với telemetry data
    TrackingDeviceID    VARCHAR(64)   NULL,
    
    -- Số container vận chuyển (e.g., "MSCU1234567")
    ContainerNumber     VARCHAR(32)   NULL,
    
    -- Số seal chống giả mạo - dùng để verify integrity
    SealNumber          VARCHAR(32)   NULL,
    
    -- Timestamp khi shipment được tạo
    CreatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- Timestamp khi shipment được update - auto-update
    UpdatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    
    -- Timestamp của telemetry data mới nhất - sync từ MongoDB
    LastTelemetryAtUTC  TIMESTAMP(6)  NULL,
    
    -- Trạng thái telemetry mới nhất: OK, VIOLATION, UNKNOWN
    LastTelemetryStatus ENUM('OK','VIOLATION','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    
    -- Timestamp của check-in thủ công mới nhất - dùng để detect timeout
    LastCheckInAtUTC    TIMESTAMP(6)  NULL,
    
    -- Timestamp khi alarm được trigger
    AlarmAtUTC          TIMESTAMP(6)  NULL,
    
    -- Lý do alarm - mở rộng từ 64 lên 255 chars cho detailed messages
    AlarmReason         VARCHAR(255)  NULL,
    
    PRIMARY KEY (ShipmentID),
    
    -- Foreign Keys
    CONSTRAINT fk_shipment_cargo        FOREIGN KEY (CargoType)           REFERENCES CargoProfiles(CargoType),
    CONSTRAINT fk_shipment_shipper      FOREIGN KEY (ShipperPartyID)      REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_consignee    FOREIGN KEY (ConsigneePartyID)    REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_origin       FOREIGN KEY (OriginPortCode)      REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_destination  FOREIGN KEY (DestinationPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_current_port FOREIGN KEY (CurrentPortCode)     REFERENCES Ports(PortCode),
    
    -- Indexes for common queries
    INDEX idx_shipment_status_updated   (Status, UpdatedAtUTC),
    INDEX idx_shipment_origin_dest      (OriginPortCode, DestinationPortCode),
    INDEX idx_shipment_last_checkin     (LastCheckInAtUTC),
    INDEX idx_shipment_tracking_device  (TrackingDeviceID),
    INDEX idx_shipment_container        (ContainerNumber),
    INDEX idx_shipment_eta              (EstimatedArrivalUTC),
    INDEX idx_shipment_cargo_status     (CargoType, Status)
) ENGINE=InnoDB;
```



#### 1.5 Enhanced Ownership Table

```sql
-- Bảng lưu trữ chain of custody - ai đang giữ hàng tại thời điểm nào
CREATE TABLE Ownership (
    -- UUID cho ownership record - dùng CHAR(36) cho UUID format
    OwnershipID       CHAR(36)      NOT NULL,
    
    -- Shipment được transfer - FK to Shipments
    ShipmentID        VARCHAR(32)   NOT NULL,
    
    -- Party nhận ownership - FK to Parties
    PartyID           VARCHAR(32)   NOT NULL,
    
    -- Thời điểm bắt đầu ownership
    StartAtUTC        TIMESTAMP(6)  NOT NULL,
    
    -- Thời điểm kết thúc ownership - NULL nếu vẫn đang giữ (active ownership)
    EndAtUTC          TIMESTAMP(6)  NULL,
    
    -- Địa điểm bàn giao (text description)
    HandoverLocation  VARCHAR(255)  NOT NULL,
    
    -- Cảng bàn giao - FK to Ports, NULL nếu bàn giao ngoài cảng
    HandoverPortCode  VARCHAR(16)   NULL,
    
    -- Tình trạng hàng khi bàn giao: GOOD (tốt), DAMAGED (hư hỏng), PARTIAL (một phần)
    HandoverCondition ENUM('GOOD','DAMAGED','PARTIAL') NOT NULL DEFAULT 'GOOD',
    
    -- Ghi chú chi tiết về bàn giao - TEXT cho unlimited length
    HandoverNotes     TEXT          NULL,
    
    -- Hash của chữ ký số - dùng để verify authenticity
    HandoverSignature VARCHAR(255)  NULL,
    
    -- Party làm chứng kiến bàn giao - FK to Parties, NULL nếu không có
    WitnessPartyID    VARCHAR(32)   NULL,
    
    -- URL đến tài liệu bàn giao (PDF, image, etc.)
    HandoverDocumentURL VARCHAR(512) NULL,
    
    -- Generated column: ShipmentID nếu ownership đang active (EndAtUTC IS NULL), NULL nếu đã kết thúc
    -- Dùng STORED để có thể tạo UNIQUE constraint - đảm bảo mỗi shipment chỉ có 1 active owner
    ActiveShipmentID  VARCHAR(32)   AS (CASE WHEN EndAtUTC IS NULL THEN ShipmentID ELSE NULL END) STORED,
    
    PRIMARY KEY (OwnershipID),
    
    -- Foreign Keys
    CONSTRAINT fk_ownership_shipment  FOREIGN KEY (ShipmentID)      REFERENCES Shipments(ShipmentID),
    CONSTRAINT fk_ownership_party     FOREIGN KEY (PartyID)         REFERENCES Parties(PartyID),
    CONSTRAINT fk_ownership_port      FOREIGN KEY (HandoverPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT fk_ownership_witness   FOREIGN KEY (WitnessPartyID)  REFERENCES Parties(PartyID),
    
    -- Check constraint: EndAtUTC phải >= StartAtUTC nếu có giá trị
    CONSTRAINT chk_ownership_dates    CHECK (EndAtUTC IS NULL OR EndAtUTC >= StartAtUTC),
    
    -- Unique constraint trên ActiveShipmentID - đảm bảo chỉ 1 active ownership per shipment
    UNIQUE KEY uq_ownership_active    (ActiveShipmentID),
    
    -- Indexes
    INDEX idx_ownership_shipment_end  (ShipmentID, EndAtUTC),
    INDEX idx_ownership_party_start   (PartyID, StartAtUTC),
    INDEX idx_ownership_condition     (HandoverCondition)
) ENGINE=InnoDB;
```

#### 1.6 Enhanced AlarmEvents Table

```sql
-- Bảng lưu trữ các sự kiện cảnh báo
CREATE TABLE AlarmEvents (
    -- UUID cho alarm event
    AlarmEventID  CHAR(36)      NOT NULL,
    
    -- Shipment bị alarm - FK to Shipments
    ShipmentID    VARCHAR(32)   NOT NULL,
    
    -- Loại alarm - mở rộng từ 3 lên 7 types
    AlarmType     ENUM(
        'TEMP_VIOLATION',        -- Vi phạm nhiệt độ
        'CHECKIN_TIMEOUT',       -- Quá thời gian không check-in
        'MANUAL',                -- Alarm thủ công
        'HUMIDITY_VIOLATION',    -- Vi phạm độ ẩm
        'ROUTE_DEVIATION',       -- Lệch tuyến đường
        'UNAUTHORIZED_ACCESS',   -- Truy cập trái phép
        'DEVICE_MALFUNCTION'     -- Thiết bị hỏng
    ) NOT NULL,
    
    -- Mức độ nghiêm trọng: LOW, MEDIUM, HIGH, CRITICAL
    Severity      ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    
    -- Trạng thái xử lý: OPEN (mới), ACKNOWLEDGED (đã xác nhận), RESOLVED (đã giải quyết), FALSE_ALARM (báo nhầm)
    Status        ENUM('OPEN','ACKNOWLEDGED','RESOLVED','FALSE_ALARM') NOT NULL DEFAULT 'OPEN',
    
    -- Lý do alarm - mô tả chi tiết
    AlarmReason   VARCHAR(255)  NOT NULL,
    
    -- Thời điểm alarm xảy ra
    AlarmAtUTC    TIMESTAMP(6)  NOT NULL,
    
    -- Nguồn tạo alarm: SQL_TRIGGER (từ trigger), BATCH_SCAN (từ batch job), INTEGRATION (từ external system)
    Source        ENUM('SQL_TRIGGER','BATCH_SCAN','INTEGRATION') NOT NULL,
    
    -- User ID người xác nhận alarm - NULL nếu chưa acknowledge
    AcknowledgedBy VARCHAR(32)  NULL,
    
    -- Thời điểm xác nhận
    AcknowledgedAtUTC TIMESTAMP(6) NULL,
    
    -- User ID người giải quyết alarm - NULL nếu chưa resolve
    ResolvedBy    VARCHAR(32)   NULL,
    
    -- Thời điểm giải quyết
    ResolvedAtUTC TIMESTAMP(6)  NULL,
    
    -- Ghi chú về cách giải quyết - TEXT cho detailed notes
    ResolutionNotes TEXT         NULL,
    
    -- Timestamp khi record được tạo
    CreatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    PRIMARY KEY (AlarmEventID),
    
    -- Foreign Key
    CONSTRAINT fk_alarm_shipment FOREIGN KEY (ShipmentID) REFERENCES Shipments(ShipmentID),
    
    -- Indexes
    INDEX idx_alarm_shipment_at  (ShipmentID, AlarmAtUTC),
    INDEX idx_alarm_type_at      (AlarmType, AlarmAtUTC),
    INDEX idx_alarm_status_severity (Status, Severity),
    INDEX idx_alarm_acknowledged (AcknowledgedBy, AcknowledgedAtUTC),
    INDEX idx_alarm_unresolved   (Status, AlarmAtUTC) -- For finding open/acknowledged alarms
) ENGINE=InnoDB;
```

#### 1.7 New AuditLog Table

```sql
-- Bảng audit log để track tất cả changes cho compliance
CREATE TABLE AuditLog (
    -- Auto-increment ID cho audit record
    AuditID       BIGINT        NOT NULL AUTO_INCREMENT,
    
    -- Tên bảng bị modify (e.g., "Shipments", "Ownership")
    TableName     VARCHAR(64)   NOT NULL,
    
    -- Loại operation: INSERT, UPDATE, DELETE
    Operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    
    -- ID của record bị modify - store as string để flexible với different PK types
    RecordID      VARCHAR(64)   NOT NULL,
    
    -- Giá trị cũ trước khi modify - store as JSON cho flexible structure
    -- NULL cho INSERT operation
    OldValue      JSON          NULL,
    
    -- Giá trị mới sau khi modify - store as JSON
    -- NULL cho DELETE operation
    NewValue      JSON          NULL,
    
    -- User ID người thực hiện change - có thể là user ID hoặc "SYSTEM" cho automated changes
    ChangedBy     VARCHAR(64)   NOT NULL,
    
    -- Timestamp khi change xảy ra
    ChangedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- IP address của client thực hiện change - dùng cho security audit
    ClientIP      VARCHAR(45)   NULL, -- IPv6 max length
    
    -- User agent string - dùng để identify application/browser
    UserAgent     VARCHAR(255)  NULL,
    
    PRIMARY KEY (AuditID),
    
    -- Indexes
    INDEX idx_audit_table_time   (TableName, ChangedAtUTC),
    INDEX idx_audit_user         (ChangedBy, ChangedAtUTC),
    INDEX idx_audit_record       (TableName, RecordID),
    INDEX idx_audit_operation    (Operation, ChangedAtUTC)
) ENGINE=InnoDB
-- Partition by RANGE on ChangedAtUTC for performance với large dataset
PARTITION BY RANGE (UNIX_TIMESTAMP(ChangedAtUTC)) (
    PARTITION p_2024_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p_2024_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
    PARTITION p_2024_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
    PARTITION p_2024_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```



### 2. MongoDB Schema Enhancements

#### 2.1 Enhanced telemetry_points Collection

```javascript
const mongoose = require('mongoose');

const telemetryPointsSchema = new mongoose.Schema({
  // Meta object - dùng làm partition key cho time-series collection
  meta: {
    // Shipment ID - link to MySQL Shipments table
    shipment_id: { type: String, required: true },
    
    // Device ID của IoT tracker - dùng để identify thiết bị cụ thể
    device_id: { type: String, required: true },
    
    // Loại sensor - default là IoT_Tracker, có thể là GPS_Only, Full_Sensor, etc.
    sensor_type: { type: String, default: 'IoT_Tracker' }
  },
  
  // Timestamp - time field cho time-series collection
  t: { type: Date, required: true },
  
  // Location as GeoJSON Point - chuẩn cho geospatial queries
  location: {
    // Type phải là 'Point' cho 2dsphere index
    type: { type: String, enum: ['Point'], default: 'Point' },
    
    // Coordinates array: [longitude, latitude] - NOTE: longitude first!
    // Ví dụ: [106.682, 10.762] cho Saigon
    coordinates: { 
      type: [Number], 
      required: true,
      validate: {
        validator: function(v) {
          // Validate array length và ranges
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 &&  // longitude range
                 v[1] >= -90 && v[1] <= 90;      // latitude range
        },
        message: 'Invalid coordinates: [lng, lat] with lng in [-180,180] and lat in [-90,90]'
      }
    }
  },
  
  // Temperature (Celsius) - với validation range hợp lý
  temp: { 
    type: Number, 
    required: true,
    min: -100,  // Extreme cold (e.g., dry ice transport)
    max: 100    // Extreme heat
  },
  
  // Humidity (%) - optional, không phải tất cả devices đều có sensor này
  humidity: { 
    type: Number, 
    min: 0, 
    max: 100 
  },
  
  // Atmospheric pressure (hPa) - optional, dùng cho altitude detection
  pressure: { type: Number },
  
  // Battery level (%) - dùng để alert khi pin yếu
  battery_level: { 
    type: Number, 
    min: 0, 
    max: 100 
  },
  
  // Signal strength (%) - dùng để detect connectivity issues
  signal_strength: { 
    type: Number, 
    min: 0, 
    max: 100 
  }
}, {
  // Time-series collection configuration
  timeseries: {
    timeField: 't',           // Field chứa timestamp
    metaField: 'meta',        // Field chứa metadata (partition key)
    granularity: 'seconds'    // Granularity level: seconds, minutes, hours
  }
});

// Geospatial index cho location-based queries
// Ví dụ: Find all telemetry points within 10km of a port
telemetryPointsSchema.index({ location: '2dsphere' });

const TelemetryPoints = mongoose.model('TelemetryPoints', telemetryPointsSchema, 'telemetry_points');

module.exports = TelemetryPoints;
```

#### 2.2 Enhanced shipment_routes Collection

```javascript
const mongoose = require('mongoose');

const shipmentRoutesSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table, REQUIRED
  shipment_id: { type: String, required: true },
  
  // Origin port code - REQUIRED, link to MySQL Ports table
  origin_port: { type: String, required: true },
  
  // Destination port code - REQUIRED, link to MySQL Ports table
  destination_port: { type: String, required: true },
  
  // Planned route - array of waypoints với estimated times
  planned_route: [{
    // Port code của waypoint
    port_code: { type: String, required: true },
    
    // Thứ tự trong route (1, 2, 3, ...)
    sequence: { type: Number, required: true },
    
    // Thời gian dự kiến đến waypoint này
    estimated_arrival: { type: Date }
  }],
  
  // Actual route - array of waypoints đã đi qua với actual times
  actual_route: [{
    // Port code của waypoint
    port_code: { type: String, required: true },
    
    // Thời gian thực tế đến
    arrival_time: { type: Date, required: true },
    
    // Thời gian thực tế rời đi - NULL nếu vẫn đang ở port
    departure_time: { type: Date }
  }],
  
  // Current position - GeoJSON Point cho real-time tracking
  current_position: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  
  // Route status - trạng thái so với kế hoạch
  route_status: {
    type: String,
    enum: ['ON_SCHEDULE', 'DELAYED', 'DEVIATED', 'COMPLETED'],
    default: 'ON_SCHEDULE'
  },
  
  // Distance traveled (km) - tính từ origin
  distance_traveled_km: { type: Number, default: 0 },
  
  // Distance remaining (km) - tính đến destination
  distance_remaining_km: { type: Number },
  
  // Timestamp của telemetry data mới nhất
  last_telemetry_at: { type: Date },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes
shipmentRoutesSchema.index({ shipment_id: 1 }, { unique: true });
shipmentRoutesSchema.index({ origin_port: 1, destination_port: 1 });
shipmentRoutesSchema.index({ route_status: 1 });
shipmentRoutesSchema.index({ current_position: '2dsphere' });
shipmentRoutesSchema.index({ last_telemetry_at: -1 });

// Pre-save middleware để update updated_at
shipmentRoutesSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const ShipmentRoutes = mongoose.model('ShipmentRoutes', shipmentRoutesSchema, 'shipment_routes');

module.exports = ShipmentRoutes;
```



#### 2.3 Enhanced port_edges Collection

```javascript
const mongoose = require('mongoose');

const portEdgesSchema = new mongoose.Schema({
  // From port code - link to MySQL Ports table
  from_port: { type: String, required: true },
  
  // To port code - link to MySQL Ports table
  to_port: { type: String, required: true },
  
  // Route type - loại phương tiện vận chuyển
  route_type: { 
    type: String, 
    enum: ['SEA', 'AIR', 'LAND', 'MULTIMODAL'],
    default: 'SEA'
  },
  
  // Distance (km) - khoảng cách thực tế giữa 2 ports
  distance_km: { type: Number, required: true },
  
  // Average transit time (hours) - trung bình từ historical data
  avg_hours: { type: Number, required: true },
  
  // Minimum transit time (hours) - fastest recorded
  min_hours: { type: Number },
  
  // Maximum transit time (hours) - slowest recorded
  max_hours: { type: Number },
  
  // Standard deviation (hours) - đo độ biến động của transit time
  // Giá trị cao = route không ổn định
  std_dev_hours: { type: Number },
  
  // Number of samples - số lượng shipments đã đi qua route này
  // Dùng để đánh giá độ tin cậy của statistics
  samples: { type: Number, required: true },
  
  // Alarm rate (0-1) - tỷ lệ shipments bị alarm trên route này
  // Ví dụ: 0.05 = 5% shipments bị alarm
  alarm_rate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
  
  // Average cost (USD) - chi phí trung bình cho route này
  avg_cost_usd: { type: Number },
  
  // Carrier count - số lượng carriers phục vụ route này
  // Giá trị cao = nhiều lựa chọn
  carrier_count: { type: Number, default: 0 },
  
  // Last updated timestamp - khi nào statistics được update lần cuối
  last_updated: { type: Date, default: Date.now },
  
  // Is active flag - route có đang hoạt động không
  // false = route bị đóng hoặc không khả dụng
  is_active: { type: Boolean, default: true }
});

// Indexes
portEdgesSchema.index({ from_port: 1, to_port: 1 }, { unique: true });
portEdgesSchema.index({ alarm_rate: -1 }); // High-risk routes first
portEdgesSchema.index({ avg_hours: 1 });   // Fastest routes first
portEdgesSchema.index({ route_type: 1 });
portEdgesSchema.index({ is_active: 1, avg_cost_usd: 1 }); // Active routes by cost

const PortEdges = mongoose.model('PortEdges', portEdgesSchema, 'port_edges');

module.exports = PortEdges;
```

### 3. MySQL Triggers

#### 3.1 Trigger: Auto-create AlarmEvent when Shipment status changes to ALARM

```sql
DELIMITER $$

-- Trigger khi UPDATE Shipments và Status thay đổi thành 'ALARM'
CREATE TRIGGER trg_shipment_alarm_insert
AFTER UPDATE ON Shipments
FOR EACH ROW
BEGIN
    -- Chỉ trigger khi Status thay đổi thành 'ALARM' và trước đó không phải 'ALARM'
    IF NEW.Status = 'ALARM' AND OLD.Status != 'ALARM' THEN
        -- Tạo AlarmEvent record mới
        INSERT INTO AlarmEvents (
            AlarmEventID,
            ShipmentID,
            AlarmType,
            AlarmReason,
            AlarmAtUTC,
            Source,
            Severity
        ) VALUES (
            UUID(),                          -- Generate UUID cho AlarmEventID
            NEW.ShipmentID,                  -- ShipmentID từ record mới
            'MANUAL',                        -- Default type, có thể customize based on AlarmReason
            COALESCE(NEW.AlarmReason, 'Status changed to ALARM'), -- Dùng AlarmReason từ Shipments
            NEW.AlarmAtUTC,                  -- Timestamp từ Shipments
            'SQL_TRIGGER',                   -- Source là trigger
            'HIGH'                           -- Default severity
        );
    END IF;
END$$

DELIMITER ;
```

#### 3.2 Trigger: Validate Ownership Overlap

```sql
DELIMITER $$

-- Trigger BEFORE INSERT để validate không có ownership overlap
CREATE TRIGGER trg_ownership_validate_insert
BEFORE INSERT ON Ownership
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT;
    
    -- Check xem có ownership nào overlap với time range mới không
    SELECT COUNT(*) INTO overlap_count
    FROM Ownership
    WHERE ShipmentID = NEW.ShipmentID
      AND OwnershipID != NEW.OwnershipID
      AND (
          -- Case 1: Existing ownership chưa kết thúc (EndAtUTC IS NULL)
          (EndAtUTC IS NULL) OR
          -- Case 2: Time ranges overlap
          (NEW.StartAtUTC < EndAtUTC AND 
           (NEW.EndAtUTC IS NULL OR NEW.EndAtUTC > StartAtUTC))
      );
    
    -- Nếu có overlap, raise error
    IF overlap_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ownership overlap detected: Another active or overlapping ownership exists for this shipment';
    END IF;
    
    -- Set OwnershipID nếu chưa có (generate UUID)
    IF NEW.OwnershipID IS NULL OR NEW.OwnershipID = '' THEN
        SET NEW.OwnershipID = UUID();
    END IF;
END$$

DELIMITER ;
```

#### 3.3 Trigger: Update Shipments LastTelemetryAtUTC

```sql
DELIMITER $$

-- Trigger để sync LastTelemetryAtUTC từ external updates
-- Note: Trigger này sẽ được gọi từ sync service khi có telemetry mới từ MongoDB
CREATE TRIGGER trg_shipment_telemetry_update
BEFORE UPDATE ON Shipments
FOR EACH ROW
BEGIN
    -- Nếu LastTelemetryAtUTC được update và mới hơn giá trị cũ
    IF NEW.LastTelemetryAtUTC IS NOT NULL AND 
       (OLD.LastTelemetryAtUTC IS NULL OR NEW.LastTelemetryAtUTC > OLD.LastTelemetryAtUTC) THEN
        
        -- Auto-update UpdatedAtUTC (đã có ON UPDATE CURRENT_TIMESTAMP nhưng explicit set để chắc chắn)
        SET NEW.UpdatedAtUTC = CURRENT_TIMESTAMP(6);
        
        -- Nếu Status vẫn là NORMAL, chuyển sang IN_TRANSIT
        IF OLD.Status = 'NORMAL' THEN
            SET NEW.Status = 'IN_TRANSIT';
        END IF;
    END IF;
END$$

DELIMITER ;
```



### 4. MySQL Stored Procedures

#### 4.1 SP_TransferOwnership - Atomic Ownership Transfer

```sql
DELIMITER $$

-- Stored procedure để transfer ownership atomically
-- Input params:
--   p_ShipmentID: ID của shipment cần transfer
--   p_NewPartyID: ID của party nhận ownership mới
--   p_HandoverLocation: Địa điểm bàn giao
--   p_HandoverPortCode: Cảng bàn giao (optional)
--   p_HandoverCondition: Tình trạng hàng (GOOD/DAMAGED/PARTIAL)
--   p_HandoverNotes: Ghi chú (optional)
--   p_WitnessPartyID: Party chứng kiến (optional)
-- Output:
--   Returns new OwnershipID nếu thành công
CREATE PROCEDURE SP_TransferOwnership(
    IN p_ShipmentID VARCHAR(32),
    IN p_NewPartyID VARCHAR(32),
    IN p_HandoverLocation VARCHAR(255),
    IN p_HandoverPortCode VARCHAR(16),
    IN p_HandoverCondition ENUM('GOOD','DAMAGED','PARTIAL'),
    IN p_HandoverNotes TEXT,
    IN p_WitnessPartyID VARCHAR(32),
    OUT p_NewOwnershipID CHAR(36)
)
BEGIN
    DECLARE v_CurrentOwnershipID CHAR(36);
    DECLARE v_CurrentPartyID VARCHAR(32);
    DECLARE v_ShipmentExists INT;
    DECLARE v_NewPartyExists INT;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Validate shipment exists
    SELECT COUNT(*) INTO v_ShipmentExists
    FROM Shipments
    WHERE ShipmentID = p_ShipmentID;
    
    IF v_ShipmentExists = 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Shipment not found';
    END IF;
    
    -- Validate new party exists
    SELECT COUNT(*) INTO v_NewPartyExists
    FROM Parties
    WHERE PartyID = p_NewPartyID AND Status = 'ACTIVE';
    
    IF v_NewPartyExists = 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'New party not found or not active';
    END IF;
    
    -- Get current active ownership
    SELECT OwnershipID, PartyID INTO v_CurrentOwnershipID, v_CurrentPartyID
    FROM Ownership
    WHERE ShipmentID = p_ShipmentID AND EndAtUTC IS NULL
    LIMIT 1;
    
    -- If no current ownership found, error
    IF v_CurrentOwnershipID IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No active ownership found for this shipment';
    END IF;
    
    -- Close current ownership
    UPDATE Ownership
    SET EndAtUTC = CURRENT_TIMESTAMP(6)
    WHERE OwnershipID = v_CurrentOwnershipID;
    
    -- Create new ownership
    SET p_NewOwnershipID = UUID();
    
    INSERT INTO Ownership (
        OwnershipID,
        ShipmentID,
        PartyID,
        StartAtUTC,
        EndAtUTC,
        HandoverLocation,
        HandoverPortCode,
        HandoverCondition,
        HandoverNotes,
        WitnessPartyID
    ) VALUES (
        p_NewOwnershipID,
        p_ShipmentID,
        p_NewPartyID,
        CURRENT_TIMESTAMP(6),
        NULL,  -- NULL = active ownership
        p_HandoverLocation,
        p_HandoverPortCode,
        p_HandoverCondition,
        p_HandoverNotes,
        p_WitnessPartyID
    );
    
    -- Commit transaction
    COMMIT;
    
    -- Return success
    SELECT p_NewOwnershipID AS NewOwnershipID, 
           v_CurrentPartyID AS PreviousPartyID,
           p_NewPartyID AS NewPartyID;
END$$

DELIMITER ;
```

#### 4.2 SP_CheckTemperatureViolation - Validate Temperature Against Cargo Profile

```sql
DELIMITER $$

-- Stored procedure để check temperature violation
-- Input params:
--   p_ShipmentID: ID của shipment
--   p_CurrentTemp: Nhiệt độ hiện tại từ telemetry
-- Output:
--   Returns violation status và details
CREATE PROCEDURE SP_CheckTemperatureViolation(
    IN p_ShipmentID VARCHAR(32),
    IN p_CurrentTemp DECIMAL(6,2),
    OUT p_IsViolation BOOLEAN,
    OUT p_ViolationType VARCHAR(32),
    OUT p_AlarmEventID CHAR(36)
)
BEGIN
    DECLARE v_CargoType VARCHAR(32);
    DECLARE v_TempMin DECIMAL(6,2);
    DECLARE v_TempMax DECIMAL(6,2);
    DECLARE v_ShipmentStatus VARCHAR(32);
    
    -- Initialize output
    SET p_IsViolation = FALSE;
    SET p_ViolationType = NULL;
    SET p_AlarmEventID = NULL;
    
    -- Get shipment cargo type and current status
    SELECT CargoType, Status INTO v_CargoType, v_ShipmentStatus
    FROM Shipments
    WHERE ShipmentID = p_ShipmentID;
    
    -- If shipment not found, exit
    IF v_CargoType IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Shipment not found';
    END IF;
    
    -- Get cargo profile temperature limits
    SELECT TempMin, TempMax INTO v_TempMin, v_TempMax
    FROM CargoProfiles
    WHERE CargoType = v_CargoType;
    
    -- Check violation
    IF p_CurrentTemp < v_TempMin THEN
        SET p_IsViolation = TRUE;
        SET p_ViolationType = 'BELOW_MIN';
    ELSEIF p_CurrentTemp > v_TempMax THEN
        SET p_IsViolation = TRUE;
        SET p_ViolationType = 'ABOVE_MAX';
    END IF;
    
    -- If violation detected, create alarm event
    IF p_IsViolation = TRUE THEN
        SET p_AlarmEventID = UUID();
        
        INSERT INTO AlarmEvents (
            AlarmEventID,
            ShipmentID,
            AlarmType,
            Severity,
            Status,
            AlarmReason,
            AlarmAtUTC,
            Source
        ) VALUES (
            p_AlarmEventID,
            p_ShipmentID,
            'TEMP_VIOLATION',
            'CRITICAL',
            'OPEN',
            CONCAT('Temperature ', p_CurrentTemp, '°C is ', p_ViolationType, 
                   ' (allowed range: ', v_TempMin, '°C to ', v_TempMax, '°C)'),
            CURRENT_TIMESTAMP(6),
            'BATCH_SCAN'
        );
        
        -- Update shipment status to ALARM if not already
        IF v_ShipmentStatus != 'ALARM' THEN
            UPDATE Shipments
            SET Status = 'ALARM',
                AlarmAtUTC = CURRENT_TIMESTAMP(6),
                AlarmReason = CONCAT('Temperature violation: ', p_CurrentTemp, '°C'),
                LastTelemetryStatus = 'VIOLATION'
            WHERE ShipmentID = p_ShipmentID;
        END IF;
    ELSE
        -- No violation, update status to OK
        UPDATE Shipments
        SET LastTelemetryStatus = 'OK'
        WHERE ShipmentID = p_ShipmentID;
    END IF;
    
    -- Return results
    SELECT p_IsViolation AS IsViolation,
           p_ViolationType AS ViolationType,
           p_AlarmEventID AS AlarmEventID,
           v_TempMin AS AllowedMin,
           v_TempMax AS AllowedMax,
           p_CurrentTemp AS CurrentTemp;
END$$

DELIMITER ;
```

#### 4.3 SP_GetChainOfCustody - Retrieve Complete Ownership History

```sql
DELIMITER $$

-- Stored procedure để lấy complete chain of custody
-- Input params:
--   p_ShipmentID: ID của shipment
-- Output:
--   Returns result set với ownership history
CREATE PROCEDURE SP_GetChainOfCustody(
    IN p_ShipmentID VARCHAR(32)
)
BEGIN
    -- Return ownership history với party details, ordered by time
    SELECT 
        o.OwnershipID,
        o.ShipmentID,
        o.PartyID,
        p.Name AS PartyName,
        p.PartyType,
        o.StartAtUTC,
        o.EndAtUTC,
        CASE 
            WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
            ELSE 'COMPLETED'
        END AS OwnershipStatus,
        TIMESTAMPDIFF(HOUR, o.StartAtUTC, COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))) AS DurationHours,
        o.HandoverLocation,
        o.HandoverPortCode,
        port.Name AS HandoverPortName,
        o.HandoverCondition,
        o.HandoverNotes,
        o.WitnessPartyID,
        witness.Name AS WitnessName
    FROM Ownership o
    INNER JOIN Parties p ON o.PartyID = p.PartyID
    LEFT JOIN Ports port ON o.HandoverPortCode = port.PortCode
    LEFT JOIN Parties witness ON o.WitnessPartyID = witness.PartyID
    WHERE o.ShipmentID = p_ShipmentID
    ORDER BY o.StartAtUTC ASC;
END$$

DELIMITER ;
```



### 5. MySQL Views

#### 5.1 v_active_shipments_with_owner - Active Shipments with Current Owner

```sql
-- View để query active shipments với owner information
CREATE OR REPLACE VIEW v_active_shipments_with_owner AS
SELECT 
    -- Shipment details
    s.ShipmentID,
    s.CargoType,
    s.WeightKg,
    s.VolumeM3,
    s.Status,
    s.CurrentLocation,
    s.CurrentPortCode,
    current_port.Name AS CurrentPortName,
    s.OriginPortCode,
    origin_port.Name AS OriginPortName,
    s.DestinationPortCode,
    dest_port.Name AS DestinationPortName,
    s.EstimatedArrivalUTC,
    s.TrackingDeviceID,
    s.ContainerNumber,
    s.LastTelemetryAtUTC,
    s.LastTelemetryStatus,
    s.CreatedAtUTC,
    s.UpdatedAtUTC,
    
    -- Current owner details
    o.OwnershipID,
    o.PartyID AS CurrentOwnerID,
    p.Name AS CurrentOwnerName,
    p.PartyType AS CurrentOwnerType,
    p.Email AS CurrentOwnerEmail,
    p.Phone AS CurrentOwnerPhone,
    o.StartAtUTC AS OwnershipStartedAt,
    TIMESTAMPDIFF(HOUR, o.StartAtUTC, CURRENT_TIMESTAMP(6)) AS OwnershipDurationHours,
    
    -- Shipper details
    shipper.Name AS ShipperName,
    
    -- Consignee details
    consignee.Name AS ConsigneeName,
    
    -- Cargo profile details
    cp.TempMin,
    cp.TempMax,
    cp.RequiresRefrigeration
    
FROM Shipments s
-- Join current owner (EndAtUTC IS NULL)
LEFT JOIN Ownership o ON s.ShipmentID = o.ShipmentID AND o.EndAtUTC IS NULL
LEFT JOIN Parties p ON o.PartyID = p.PartyID
-- Join ports
LEFT JOIN Ports current_port ON s.CurrentPortCode = current_port.PortCode
LEFT JOIN Ports origin_port ON s.OriginPortCode = origin_port.PortCode
LEFT JOIN Ports dest_port ON s.DestinationPortCode = dest_port.PortCode
-- Join shipper and consignee
LEFT JOIN Parties shipper ON s.ShipperPartyID = shipper.PartyID
LEFT JOIN Parties consignee ON s.ConsigneePartyID = consignee.PartyID
-- Join cargo profile
LEFT JOIN CargoProfiles cp ON s.CargoType = cp.CargoType
-- Filter only active shipments (not completed)
WHERE s.Status != 'COMPLETED';
```

#### 5.2 v_alarm_summary_by_cargo_type - Alarm Statistics by Cargo Type

```sql
-- View để analyze alarm patterns by cargo type
CREATE OR REPLACE VIEW v_alarm_summary_by_cargo_type AS
SELECT 
    s.CargoType,
    COUNT(DISTINCT a.AlarmEventID) AS TotalAlarms,
    COUNT(DISTINCT s.ShipmentID) AS AffectedShipments,
    
    -- Breakdown by alarm type
    SUM(CASE WHEN a.AlarmType = 'TEMP_VIOLATION' THEN 1 ELSE 0 END) AS TempViolations,
    SUM(CASE WHEN a.AlarmType = 'HUMIDITY_VIOLATION' THEN 1 ELSE 0 END) AS HumidityViolations,
    SUM(CASE WHEN a.AlarmType = 'CHECKIN_TIMEOUT' THEN 1 ELSE 0 END) AS CheckinTimeouts,
    SUM(CASE WHEN a.AlarmType = 'ROUTE_DEVIATION' THEN 1 ELSE 0 END) AS RouteDeviations,
    SUM(CASE WHEN a.AlarmType = 'DEVICE_MALFUNCTION' THEN 1 ELSE 0 END) AS DeviceMalfunctions,
    
    -- Breakdown by severity
    SUM(CASE WHEN a.Severity = 'CRITICAL' THEN 1 ELSE 0 END) AS CriticalAlarms,
    SUM(CASE WHEN a.Severity = 'HIGH' THEN 1 ELSE 0 END) AS HighAlarms,
    SUM(CASE WHEN a.Severity = 'MEDIUM' THEN 1 ELSE 0 END) AS MediumAlarms,
    SUM(CASE WHEN a.Severity = 'LOW' THEN 1 ELSE 0 END) AS LowAlarms,
    
    -- Status breakdown
    SUM(CASE WHEN a.Status = 'OPEN' THEN 1 ELSE 0 END) AS OpenAlarms,
    SUM(CASE WHEN a.Status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) AS AcknowledgedAlarms,
    SUM(CASE WHEN a.Status = 'RESOLVED' THEN 1 ELSE 0 END) AS ResolvedAlarms,
    
    -- Average resolution time (hours) for resolved alarms
    AVG(
        CASE 
            WHEN a.Status = 'RESOLVED' AND a.ResolvedAtUTC IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, a.AlarmAtUTC, a.ResolvedAtUTC)
            ELSE NULL
        END
    ) AS AvgResolutionTimeHours,
    
    -- Latest alarm timestamp
    MAX(a.AlarmAtUTC) AS LatestAlarmAt
    
FROM Shipments s
INNER JOIN AlarmEvents a ON s.ShipmentID = a.ShipmentID
GROUP BY s.CargoType
ORDER BY TotalAlarms DESC;
```

#### 5.3 v_shipment_journey_timeline - Complete Journey Timeline

```sql
-- View để xem complete timeline của shipment journey
CREATE OR REPLACE VIEW v_shipment_journey_timeline AS
-- Shipment creation event
SELECT 
    s.ShipmentID,
    'SHIPMENT_CREATED' AS EventType,
    s.CreatedAtUTC AS EventTimestamp,
    NULL AS PartyID,
    NULL AS PartyName,
    s.OriginPortCode AS LocationCode,
    origin.Name AS LocationName,
    'Shipment created' AS EventDescription,
    1 AS EventSequence
FROM Shipments s
LEFT JOIN Ports origin ON s.OriginPortCode = origin.PortCode

UNION ALL

-- Ownership transfers
SELECT 
    o.ShipmentID,
    'OWNERSHIP_TRANSFER' AS EventType,
    o.StartAtUTC AS EventTimestamp,
    o.PartyID,
    p.Name AS PartyName,
    o.HandoverPortCode AS LocationCode,
    port.Name AS LocationName,
    CONCAT('Ownership transferred to ', p.Name, ' (', p.PartyType, ')') AS EventDescription,
    2 AS EventSequence
FROM Ownership o
INNER JOIN Parties p ON o.PartyID = p.PartyID
LEFT JOIN Ports port ON o.HandoverPortCode = port.PortCode

UNION ALL

-- Alarm events
SELECT 
    a.ShipmentID,
    'ALARM' AS EventType,
    a.AlarmAtUTC AS EventTimestamp,
    NULL AS PartyID,
    NULL AS PartyName,
    NULL AS LocationCode,
    NULL AS LocationName,
    CONCAT(a.Severity, ' ', a.AlarmType, ': ', a.AlarmReason) AS EventDescription,
    3 AS EventSequence
FROM AlarmEvents a

UNION ALL

-- Shipment completion
SELECT 
    s.ShipmentID,
    'SHIPMENT_COMPLETED' AS EventType,
    s.ActualArrivalUTC AS EventTimestamp,
    NULL AS PartyID,
    NULL AS PartyName,
    s.DestinationPortCode AS LocationCode,
    dest.Name AS LocationName,
    'Shipment completed' AS EventDescription,
    4 AS EventSequence
FROM Shipments s
LEFT JOIN Ports dest ON s.DestinationPortCode = dest.PortCode
WHERE s.Status = 'COMPLETED' AND s.ActualArrivalUTC IS NOT NULL

-- Order by shipment and timestamp
ORDER BY ShipmentID, EventTimestamp, EventSequence;
```



## Data Models

### Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Parties   │         │    Ports    │         │CargoProfiles│
│             │         │             │         │             │
│ PartyID (PK)│         │PortCode (PK)│         │CargoType(PK)│
│ PartyType   │         │ Name        │         │ TempMin     │
│ Name        │         │ Country     │         │ TempMax     │
│ Email       │         │ Latitude    │         │ HumidityMin │
│ Phone       │         │ Longitude   │         │ HumidityMax │
│ Status      │         │ Timezone    │         │ MaxTransit  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │                       │                       │
       │    ┌──────────────────┴───────────────────────┘
       │    │                  │
       │    │                  │
       ▼    ▼                  ▼
┌─────────────────────────────────────────┐
│            Shipments                    │
│                                         │
│ ShipmentID (PK)                        │
│ CargoType (FK)                         │
│ ShipperPartyID (FK)                    │
│ ConsigneePartyID (FK)                  │
│ OriginPortCode (FK)                    │
│ DestinationPortCode (FK)               │
│ CurrentPortCode (FK)                   │
│ Status, WeightKg, VolumeM3             │
│ EstimatedArrivalUTC, ActualArrivalUTC  │
│ TrackingDeviceID, ContainerNumber      │
└────────┬────────────────────┬───────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────┐   ┌─────────────────┐
│   Ownership     │   │  AlarmEvents    │
│                 │   │                 │
│ OwnershipID(PK) │   │AlarmEventID(PK) │
│ ShipmentID (FK) │   │ ShipmentID (FK) │
│ PartyID (FK)    │   │ AlarmType       │
│ StartAtUTC      │   │ Severity        │
│ EndAtUTC        │   │ Status          │
│ HandoverLocation│   │ AlarmReason     │
│ HandoverCondition│  │ AcknowledgedBy  │
│ WitnessPartyID  │   │ ResolvedBy      │
└─────────────────┘   └─────────────────┘

MongoDB Collections (linked via ShipmentID):
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│telemetry_points  │  │ shipment_routes  │  │   port_edges     │
│                  │  │                  │  │                  │
│ meta.shipment_id │  │ shipment_id      │  │ from_port        │
│ t (timestamp)    │  │ origin_port      │  │ to_port          │
│ location (GeoJSON│  │ destination_port │  │ route_type       │
│ temp, humidity   │  │ planned_route[]  │  │ avg_hours        │
│ battery_level    │  │ actual_route[]   │  │ alarm_rate       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    IoT Device Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Tracker 1│  │ Tracker 2│  │ Tracker N│                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
└───────┼─────────────┼─────────────┼────────────────────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   Telemetry Ingestion   │
        │      Service            │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│   MongoDB    │          │    MySQL     │
│              │◄────────►│              │
│ INSERT       │   Sync   │ UPDATE       │
│ telemetry_   │  Layer   │ Shipments.   │
│ points       │          │ LastTelemetry│
└──────┬───────┘          └──────┬───────┘
       │                         │
       │                         │
       ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Change Stream│          │   Triggers   │
│   Handler    │          │              │
└──────┬───────┘          └──────┬───────┘
       │                         │
       └────────────┬────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │  Alert Service   │
          │                  │
          │ • Email          │
          │ • SMS            │
          │ • Dashboard      │
          └──────────────────┘
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Party UpdatedAtUTC Auto-Update
*For any* Party record, when any field is modified, the UpdatedAtUTC timestamp should be automatically updated to a value greater than the previous timestamp.
**Validates: Requirements 1.5**

### Property 2: Telemetry Coordinate Validation - Longitude
*For any* telemetry_points document, the longitude value in location.coordinates[0] must be within the range [-180, 180].
**Validates: Requirements 7.4**

### Property 3: Telemetry Coordinate Validation - Latitude
*For any* telemetry_points document, the latitude value in location.coordinates[1] must be within the range [-90, 90].
**Validates: Requirements 7.5**

### Property 4: Telemetry Temperature Validation
*For any* telemetry_points document, the temperature value must be within the range [-100, 100] degrees Celsius.
**Validates: Requirements 7.6**

### Property 5: Port Edge Alarm Rate Validation
*For any* port_edges document, the alarm_rate value must be within the range [0, 1] representing a percentage.
**Validates: Requirements 9.10**

### Property 6: Shipment Status Change Triggers Alarm Creation
*For any* Shipment record, when the Status field changes from any non-ALARM value to 'ALARM', an AlarmEvent record should be automatically created with matching ShipmentID.
**Validates: Requirements 10.1**

### Property 7: Alarm Event Fields Population
*For any* AlarmEvent created by trigger when Shipment status changes to ALARM, all required fields (AlarmType, AlarmReason, AlarmAtUTC, Source) must be populated with non-null values.
**Validates: Requirements 10.2**

### Property 8: Ownership Non-Overlap Constraint
*For any* two Ownership records with the same ShipmentID, their time ranges (StartAtUTC to EndAtUTC) must not overlap, ensuring only one party owns a shipment at any given time.
**Validates: Requirements 10.3**

### Property 9: Single Active Ownership Per Shipment
*For any* Shipment, there must be at most one Ownership record with EndAtUTC = NULL (active ownership) at any point in time.
**Validates: Requirements 10.4**

### Property 10: Telemetry Update Triggers LastTelemetryAtUTC
*For any* Shipment, when LastTelemetryAtUTC is updated to a new value, the UpdatedAtUTC field should also be updated automatically.
**Validates: Requirements 10.5**

### Property 11: Alarm Creation Updates Shipment Fields
*For any* AlarmEvent created, the corresponding Shipment record should have its AlarmAtUTC and AlarmReason fields updated to match the alarm event.
**Validates: Requirements 10.6**

### Property 12: SP_TransferOwnership Atomicity
*For any* valid ownership transfer via SP_TransferOwnership, either both operations (closing old ownership and creating new ownership) succeed, or both fail, ensuring atomicity.
**Validates: Requirements 11.1**

### Property 13: SP_CheckTemperatureViolation Detection
*For any* Shipment and temperature value, when SP_CheckTemperatureViolation is called, if the temperature is outside the cargo profile's [TempMin, TempMax] range, the procedure must return IsViolation = TRUE and create an AlarmEvent.
**Validates: Requirements 11.4, 11.6**

### Property 14: SP_GetChainOfCustody Completeness
*For any* Shipment, SP_GetChainOfCustody must return all Ownership records for that shipment, ordered chronologically by StartAtUTC.
**Validates: Requirements 11.7, 11.8**

### Property 15: MongoDB to MySQL Telemetry Sync
*For any* telemetry_points document inserted in MongoDB, the corresponding Shipment record in MySQL should have its LastTelemetryAtUTC field updated to match the telemetry timestamp.
**Validates: Requirements 13.1**

### Property 16: Temperature Violation Cross-Database Sync
*For any* temperature violation detected in MongoDB telemetry data, an AlarmEvent record must be created in MySQL with AlarmType = 'TEMP_VIOLATION'.
**Validates: Requirements 13.2**

### Property 17: MySQL to MongoDB Shipment Creation Sync
*For any* Shipment created in MySQL, a corresponding shipment_routes document must be created in MongoDB with matching shipment_id, origin_port, and destination_port.
**Validates: Requirements 13.3**

### Property 18: Shipment Status Sync to MongoDB
*For any* Shipment status change in MySQL, the corresponding shipment_routes document in MongoDB should have its route_status field updated accordingly.
**Validates: Requirements 13.4**

### Property 19: Successful Sync Audit Trail
*For any* successful synchronization operation between MySQL and MongoDB, a sync timestamp must be recorded for audit purposes.
**Validates: Requirements 13.6**

### Property 20: Shipment Routes Referential Integrity
*For any* shipment_routes document insertion attempt, if the shipment_id does not exist in MySQL Shipments table, the operation must be rejected with an error.
**Validates: Requirements 14.1**

### Property 21: Telemetry Points Referential Integrity
*For any* telemetry_points document insertion attempt, if the meta.shipment_id does not exist in MySQL Shipments table, the operation must be rejected with an error.
**Validates: Requirements 14.2**

### Property 22: Port Edges Referential Integrity
*For any* port_edges document insertion attempt, if either from_port or to_port does not exist in MySQL Ports table, the operation must be rejected with an error.
**Validates: Requirements 14.3**

### Property 23: Validation Success Allows Insert
*For any* MongoDB document insertion, if all referential integrity validations pass, the insert operation must succeed.
**Validates: Requirements 14.5**

### Property 24: Validation Cache Consistency
*For any* repeated validation of the same reference within the TTL window (5 minutes), the cached result must be used, and the result must be consistent with the actual database state.
**Validates: Requirements 14.6**

### Property 25: Change Stream Temperature Alert
*For any* telemetry_points document inserted with temperature exceeding cargo profile limits, the Change Stream handler must create a telemetry_logs entry with event_type = 'TEMP_ALERT'.
**Validates: Requirements 15.2**

### Property 26: Change Stream Battery Low Alert
*For any* telemetry_points document inserted with battery_level below 20%, the Change Stream handler must create a telemetry_logs entry with event_type = 'BATTERY_LOW'.
**Validates: Requirements 15.4**

### Property 27: Audit Log Record Creation
*For any* critical data modification (INSERT, UPDATE, DELETE) on tracked tables, an AuditLog record must be created with TableName, Operation, RecordID, and ChangedAtUTC populated.
**Validates: Requirements 16.1**

### Property 28: Audit Log Value Capture
*For any* UPDATE operation logged in AuditLog, both OldValue and NewValue fields must be populated with JSON representations of the record state before and after the change.
**Validates: Requirements 16.2**



## Error Handling

### Database-Level Error Handling

**MySQL Errors:**
1. **Constraint Violations**: CHECK constraints, FOREIGN KEY violations, UNIQUE violations
   - Return SQLSTATE codes (e.g., '23000' for integrity constraint violation)
   - Provide descriptive error messages via SIGNAL statement in triggers
   
2. **Trigger Errors**: Custom validation failures in triggers
   - Use SIGNAL SQLSTATE '45000' for custom errors
   - Include detailed MESSAGE_TEXT explaining the violation
   
3. **Stored Procedure Errors**: Business logic validation failures
   - ROLLBACK transaction on error
   - Return error status and message to caller
   - Log errors to AuditLog table

**MongoDB Errors:**
1. **Validation Errors**: Schema validation failures
   - Return ValidationError with details about which field failed
   - Include validator message in error response
   
2. **Duplicate Key Errors**: Unique index violations
   - Return E11000 error code
   - Identify which index was violated
   
3. **Connection Errors**: Network or database unavailability
   - Implement retry logic with exponential backoff
   - Log connection failures for monitoring

### Application-Level Error Handling

**Sync Layer Errors:**
1. **Referential Integrity Failures**: Invalid foreign key references
   - Validate before insert/update
   - Return descriptive error: "Invalid shipment_id: XYZ does not exist"
   - Do not proceed with operation
   
2. **Sync Failures**: Cross-database synchronization errors
   - Log error with full context (source, target, operation, data)
   - Implement retry queue with exponential backoff
   - Alert operations team after 3 failed retries
   - Maintain sync status table for monitoring
   
3. **Timeout Errors**: Long-running operations
   - Set reasonable timeouts (e.g., 30 seconds for sync operations)
   - Implement circuit breaker pattern
   - Fallback to eventual consistency mode

**Change Stream Errors:**
1. **Handler Failures**: Exception in change stream handler
   - Log error with change event details
   - Continue processing subsequent events (don't block stream)
   - Implement dead letter queue for failed events
   
2. **Resume Token Errors**: Change stream interruption
   - Store resume tokens periodically
   - Resume from last known good position
   - Full resync if resume token expired

### Error Recovery Strategies

**Transactional Consistency:**
- Use MySQL transactions for multi-step operations
- Implement compensating transactions for cross-database operations
- Maintain idempotency for retry safety

**Data Consistency:**
- Implement reconciliation jobs to detect and fix inconsistencies
- Run daily consistency checks between MySQL and MongoDB
- Alert on discrepancies exceeding threshold

**Monitoring and Alerting:**
- Track error rates by type and severity
- Alert on error rate spikes (>5% of operations)
- Dashboard showing sync lag and error counts

## Testing Strategy

### Unit Testing

**Database Schema Tests:**
- Verify all tables/collections exist with correct structure
- Verify all indexes exist and are used by queries (EXPLAIN ANALYZE)
- Verify all constraints are enforced (CHECK, FOREIGN KEY, UNIQUE)
- Test default values and auto-increment behavior

**Trigger Tests:**
- Test trigger execution on INSERT/UPDATE/DELETE
- Test trigger error handling and rollback
- Test trigger performance impact

**Stored Procedure Tests:**
- Test each SP with valid inputs
- Test error cases (invalid inputs, missing data)
- Test transaction rollback on error
- Test SP performance with large datasets

**View Tests:**
- Verify view returns correct data
- Test view performance with indexes
- Test view with edge cases (empty tables, NULL values)

### Property-Based Testing

**Testing Framework:** 
- Use **fast-check** for JavaScript/Node.js property-based testing
- Configure each test to run minimum 100 iterations

**Property Test Structure:**
```javascript
const fc = require('fast-check');

// Example property test
fc.assert(
  fc.property(
    fc.record({
      shipment_id: fc.string(),
      temp: fc.float({ min: -100, max: 100 })
    }),
    async (telemetry) => {
      // Test property here
    }
  ),
  { numRuns: 100 }
);
```

**Generators:**
- **ShipmentGenerator**: Generate valid shipment records with all required fields
- **TelemetryGenerator**: Generate telemetry data with valid coordinates and sensor values
- **OwnershipGenerator**: Generate ownership records with valid time ranges
- **PortGenerator**: Generate port records with valid coordinates

**Property Tests to Implement:**

1. **Property 1 Test**: Party UpdatedAtUTC Auto-Update
   - Generator: Create random Party record
   - Action: Update random field
   - Assertion: UpdatedAtUTC > original timestamp

2. **Property 2-4 Tests**: Telemetry Validation
   - Generator: Create telemetry with random coordinates and temperature
   - Action: Attempt to insert
   - Assertion: Valid data succeeds, invalid data fails with validation error

3. **Property 6-7 Tests**: Alarm Trigger
   - Generator: Create random Shipment
   - Action: Update Status to 'ALARM'
   - Assertion: AlarmEvent created with all required fields

4. **Property 8-9 Tests**: Ownership Constraints
   - Generator: Create two Ownership records for same shipment
   - Action: Attempt to insert overlapping ownerships
   - Assertion: Second insert fails with constraint violation

5. **Property 13 Tests**: Temperature Violation Detection
   - Generator: Create Shipment with CargoProfile, generate random temperature
   - Action: Call SP_CheckTemperatureViolation
   - Assertion: Violation detected correctly, alarm created if needed

6. **Property 15-18 Tests**: Cross-Database Sync
   - Generator: Create random data in source database
   - Action: Trigger sync
   - Assertion: Target database updated correctly

7. **Property 20-22 Tests**: Referential Integrity
   - Generator: Create document with random shipment_id/port_code
   - Action: Attempt to insert
   - Assertion: Insert succeeds only if reference exists

### Integration Testing

**Cross-Database Integration:**
- Test complete flow: IoT device → MongoDB → Sync → MySQL → Alert
- Test bidirectional sync: MySQL ↔ MongoDB
- Test Change Stream handlers with real data
- Test stored procedures calling across databases

**Performance Testing:**
- Load test with 10,000 concurrent telemetry inserts
- Measure sync lag under high load
- Test query performance with millions of records
- Test index effectiveness with EXPLAIN ANALYZE

**Failure Scenario Testing:**
- Test behavior when MySQL is down
- Test behavior when MongoDB is down
- Test network partition scenarios
- Test recovery after database restart

### Test Data Management

**Test Database Setup:**
- Use Docker containers for isolated test databases
- Seed with realistic test data (ports, cargo profiles, parties)
- Reset database state between test runs

**Test Data Generators:**
- Generate realistic shipment IDs, tracking device IDs
- Generate realistic port codes (UN/LOCODE format)
- Generate realistic timestamps with proper sequencing
- Generate realistic geolocation data for major ports

### Continuous Testing

**CI/CD Integration:**
- Run unit tests on every commit
- Run property tests on every PR
- Run integration tests nightly
- Run performance tests weekly

**Test Coverage Goals:**
- 90% code coverage for application logic
- 100% coverage for critical paths (sync, alarms, ownership)
- All stored procedures tested
- All triggers tested
- All views tested

