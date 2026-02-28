-- ============================================================================
-- COMPLETE MySQL SCHEMA FOR GLOBAL SUPPLY CHAIN & ASSET TELEMETRY SYSTEM
-- ============================================================================
-- Description: Consolidated schema file containing all tables with enhancements
-- Database: supply_chain_sql
-- Created: 2026-02-25
-- ============================================================================

USE supply_chain_sql;

-- ============================================================================
-- TABLE: Parties
-- Description: Stores information about all parties involved in supply chain
-- ============================================================================
CREATE TABLE IF NOT EXISTS Parties (
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
    
    -- Index để query nhanh parties theo type và status
    INDEX idx_party_type_status (PartyType, Status),
    
    -- Index để search by email
    INDEX idx_party_email (Email)
) ENGINE=InnoDB COMMENT='Stores information about all parties in supply chain';

-- ============================================================================
-- TABLE: Ports
-- Description: Stores information about seaports, airports, and inland ports
-- ============================================================================
CREATE TABLE IF NOT EXISTS Ports (
    -- Mã cảng theo chuẩn UN/LOCODE (e.g., VNSGN for Saigon Port)
    PortCode  VARCHAR(16)   NOT NULL,
    
    -- Tên đầy đủ của cảng
    Name      VARCHAR(255)  NOT NULL,
    
    -- Quốc gia nơi cảng tọa lạc
    Country   VARCHAR(128)  NOT NULL,
    
    -- Vĩ độ - dùng DECIMAL(10,8) cho độ chính xác cao (±90 degrees, 8 decimal places)
    Latitude  DECIMAL(10,8) NULL,
    
    -- Kinh độ - dùng DECIMAL(11,8) cho độ chính xác cao (±180 degrees, 8 decimal places)
    Longitude DECIMAL(11,8) NULL,
    
    -- IANA timezone identifier (e.g., 'Asia/Ho_Chi_Minh')
    Timezone  VARCHAR(64)   NULL,
    
    -- Trạng thái hoạt động
    Status    ENUM('OPERATIONAL','CLOSED','RESTRICTED') NOT NULL DEFAULT 'OPERATIONAL',

    PRIMARY KEY (PortCode),
    
    -- Index để query ports by country
    INDEX idx_port_country (Country),
    
    -- Composite index cho geospatial queries
    INDEX idx_port_location (Latitude, Longitude),
    
    -- Index để filter by status
    INDEX idx_port_status (Status)
) ENGINE=InnoDB COMMENT='Stores port information with geolocation data';

-- ============================================================================
-- TABLE: CargoProfiles
-- Description: Defines transport conditions for different cargo types
-- ============================================================================
CREATE TABLE IF NOT EXISTS CargoProfiles (
    CargoProfileID VarCHAR(32)    NOT NULL,

    -- Loại hàng hóa: VACCINE, FROZEN_FOOD, PHARMA, OTHER
    CargoType  VARCHAR(32)    NOT NULL,

    -- Tên cụ thể của hàng hóa ('VAC_COVID19', 'VAC_FLU', 'PHARMA_INSULIN', 'FROZEN_SEAFOOD', etc.)
    CargoName         VARCHAR(128)  NOT NULL,    
    
    -- Nhiệt độ tối thiểu cho phép (Celsius)
    TempMin    DECIMAL(6,2)   NOT NULL,
    
    -- Nhiệt độ tối đa cho phép (Celsius)
    TempMax    DECIMAL(6,2)   NOT NULL,
    
    -- Độ ẩm tối thiểu cho phép (%)
    HumidityMin DECIMAL(5,2)  NULL,
    
    -- Độ ẩm tối đa cho phép (%)
    HumidityMax DECIMAL(5,2)  NULL,
    
    -- Thời gian vận chuyển tối đa cho phép (giờ)
    MaxTransitHours INT        NULL,
    
    -- Hướng dẫn xử lý hàng hóa
    HandlingInstructions TEXT  NULL,
    
    PRIMARY KEY (CargoProfileID),
    
    -- Constraint đảm bảo TempMin < TempMax
    CONSTRAINT chk_cargo_temp CHECK (TempMin < TempMax),
    
    -- Constraint đảm bảo HumidityMin < HumidityMax
    CONSTRAINT chk_cargo_humidity CHECK (
        HumidityMin IS NULL OR 
        HumidityMax IS NULL OR 
        HumidityMin < HumidityMax
    )
) ENGINE=InnoDB COMMENT='Defines transport conditions for cargo types';

-- ============================================================================
-- TABLE: Shipments
-- Description: Central table storing shipment information
-- ============================================================================
CREATE TABLE IF NOT EXISTS Shipments (
    -- Unique identifier cho shipment
    ShipmentID          VARCHAR(32)   NOT NULL,
    
    -- hàng hóa - FK to CargoProfiles
    CargoProfileID      VARCHAR(32)   NOT NULL,
    
    -- Trọng lượng hàng hóa (kg)
    WeightKg            DECIMAL(10,2) NOT NULL,
    
    -- Thể tích hàng hóa (m³)
    VolumeM3            DECIMAL(10,2) NULL,
    
    -- Party ID của người gửi hàng
    ShipperPartyID      VARCHAR(32)   NOT NULL,
    
    -- Party ID của người nhận hàng
    ConsigneePartyID    VARCHAR(32)   NOT NULL,
    
    -- Cảng xuất phát
    OriginPortCode      VARCHAR(16)   NOT NULL,
    
    -- Cảng đích
    DestinationPortCode VARCHAR(16)   NOT NULL,
    
    -- Trạng thái hiện tại
    Status              ENUM('NORMAL','IN_TRANSIT','ALARM','COMPLETED') NOT NULL,
    
    -- Mô tả vị trí hiện tại (text)
    CurrentLocation     VARCHAR(255)  NULL,
    
    -- Cảng hiện tại
    CurrentPortCode     VARCHAR(16)   NULL,
    
    -- ID của thiết bị IoT tracking
    TrackingDeviceID    VARCHAR(64)   NULL,
    
    -- Timestamp khi shipment được tạo
    CreatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- Timestamp khi shipment được update
    UpdatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    
    -- Timestamp của telemetry data mới nhất
    LastTelemetryAtUTC  TIMESTAMP(6)  NULL,
    
    -- Trạng thái telemetry mới nhất
    LastTelemetryStatus ENUM('OK','VIOLATION','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    
    -- Timestamp của check-in thủ công mới nhất
    LastCheckInAtUTC    TIMESTAMP(6)  NULL,
    
    -- Timestamp khi alarm được trigger
    AlarmAtUTC          TIMESTAMP(6)  NULL,
    
    -- Lý do alarm
    AlarmReason         VARCHAR(255)  NULL,
    
    PRIMARY KEY (ShipmentID),
    
    -- Foreign Keys
    CONSTRAINT fk_shipment_cargo        FOREIGN KEY (CargoProfileID)      REFERENCES CargoProfiles(CargoProfileID),
    CONSTRAINT fk_shipment_shipper      FOREIGN KEY (ShipperPartyID)      REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_consignee    FOREIGN KEY (ConsigneePartyID)    REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_origin       FOREIGN KEY (OriginPortCode)      REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_destination  FOREIGN KEY (DestinationPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_current_port FOREIGN KEY (CurrentPortCode)     REFERENCES Ports(PortCode),
    
    -- Indexes
    INDEX idx_shipment_status_updated   (Status, UpdatedAtUTC),
    INDEX idx_shipment_origin_dest      (OriginPortCode, DestinationPortCode),
    INDEX idx_shipment_last_checkin     (LastCheckInAtUTC),
    INDEX idx_shipment_tracking_device  (TrackingDeviceID),
    INDEX idx_shipment_cargo_status     (CargoProfileID, Status)
) ENGINE=InnoDB COMMENT='Central table storing shipment information';

-- ============================================================================
-- TABLE: Ownership
-- Description: Tracks chain of custody for shipments
-- ============================================================================
CREATE TABLE IF NOT EXISTS Ownership (
    -- UUID cho ownership record
    OwnershipID       CHAR(36)      NOT NULL,
    
    -- Shipment được transfer
    ShipmentID        VARCHAR(32)   NOT NULL,
    
    -- Party nhận ownership
    PartyID           VARCHAR(32)   NOT NULL,
    
    -- Thời điểm bắt đầu ownership
    StartAtUTC        TIMESTAMP(6)  NOT NULL,
    
    -- Thời điểm kết thúc ownership
    EndAtUTC          TIMESTAMP(6)  NULL,
    
    -- Cảng bàn giao
    HandoverPortCode  VARCHAR(16)   NULL,
    
    -- Tình trạng hàng khi bàn giao
    HandoverCondition ENUM('GOOD','DAMAGED','PARTIAL') NOT NULL DEFAULT 'GOOD',
    
    -- Ghi chú chi tiết về bàn giao
    HandoverNotes     TEXT          NULL,
    
    -- Hash của chữ ký số
    HandoverSignature VARCHAR(255)  NULL,
    
    -- Party làm chứng kiến bàn giao
    WitnessPartyID    VARCHAR(32)   NULL,
    
    
    -- Generated column: ShipmentID nếu ownership đang active
    ActiveShipmentID  VARCHAR(32)   AS (CASE WHEN EndAtUTC IS NULL THEN ShipmentID ELSE NULL END) STORED,
    
    PRIMARY KEY (OwnershipID),
    
    -- Foreign Keys
    CONSTRAINT fk_ownership_shipment  FOREIGN KEY (ShipmentID)      REFERENCES Shipments(ShipmentID),
    CONSTRAINT fk_ownership_party     FOREIGN KEY (PartyID)         REFERENCES Parties(PartyID),
    CONSTRAINT fk_ownership_port      FOREIGN KEY (HandoverPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT fk_ownership_witness   FOREIGN KEY (WitnessPartyID)  REFERENCES Parties(PartyID),
    
    -- Check constraint
    CONSTRAINT chk_ownership_dates    CHECK (EndAtUTC IS NULL OR EndAtUTC >= StartAtUTC),
    
    -- Unique constraint trên ActiveShipmentID
    UNIQUE KEY uq_ownership_active    (ActiveShipmentID),
    
    -- Indexes
    INDEX idx_ownership_shipment_end  (ShipmentID, EndAtUTC),
    INDEX idx_ownership_party_start   (PartyID, StartAtUTC),
    INDEX idx_ownership_condition     (HandoverCondition)
) ENGINE=InnoDB COMMENT='Tracks chain of custody for shipments';

-- ============================================================================
-- TABLE: AlarmEvents
-- Description: Stores alarm events for shipments
-- ============================================================================
CREATE TABLE IF NOT EXISTS AlarmEvents (
    -- UUID cho alarm event
    AlarmEventID  CHAR(36)      NOT NULL,
    
    -- Shipment bị alarm
    ShipmentID    VARCHAR(32)   NOT NULL,
    
    -- Loại alarm
    AlarmType     ENUM(
        'TEMP_VIOLATION',
        'CHECKIN_TIMEOUT',
        'MANUAL',
        'HUMIDITY_VIOLATION',
        'ROUTE_DEVIATION',
        'UNAUTHORIZED_ACCESS',
        'DEVICE_MALFUNCTION'
    ) NOT NULL,
    
    -- Mức độ nghiêm trọng
    Severity      ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    
    -- Trạng thái xử lý
    Status        ENUM('OPEN','ACKNOWLEDGED','RESOLVED','FALSE_ALARM') NOT NULL DEFAULT 'OPEN',
    
    -- Lý do alarm
    AlarmReason   VARCHAR(255)  NOT NULL,
    
    -- Thời điểm alarm xảy ra
    AlarmAtUTC    TIMESTAMP(6)  NOT NULL,
    
    -- Nguồn tạo alarm
    Source        ENUM('SQL_TRIGGER','BATCH_SCAN','INTEGRATION') NOT NULL,
    
    -- User ID người xác nhận alarm
    AcknowledgedBy VARCHAR(32)  NULL,
    
    -- Thời điểm xác nhận
    AcknowledgedAtUTC TIMESTAMP(6) NULL,
    
    -- User ID người giải quyết alarm
    ResolvedBy    VARCHAR(32)   NULL,
    
    -- Thời điểm giải quyết
    ResolvedAtUTC TIMESTAMP(6)  NULL,
    
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
    INDEX idx_alarm_unresolved   (Status, AlarmAtUTC)
) ENGINE=InnoDB COMMENT='Stores alarm events for shipments';

-- ============================================================================
-- TABLE: AuditLog
-- Description: Audit log for compliance tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS AuditLog (
    -- Auto-increment ID cho audit record
    AuditID       BIGINT        NOT NULL AUTO_INCREMENT,
    
    -- Tên bảng bị modify
    TableName     VARCHAR(64)   NOT NULL,
    
    -- Loại operation
    Operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    
    -- ID của record bị modify
    RecordID      VARCHAR(64)   NOT NULL,
    
    -- Giá trị cũ trước khi modify
    OldValue      JSON          NULL,
    
    -- Giá trị mới sau khi modify
    NewValue      JSON          NULL,
    
    -- User ID người thực hiện change
    ChangedBy     VARCHAR(64)   NOT NULL,
    
    -- Timestamp khi change xảy ra
    ChangedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    
    -- IP address của client
    ClientIP      VARCHAR(45)   NULL,
    
    -- User agent string
    UserAgent     VARCHAR(255)  NULL,
    
    PRIMARY KEY (AuditID, ChangedAtUTC),
    
    -- Indexes
    INDEX idx_audit_table_time   (TableName, ChangedAtUTC),
    INDEX idx_audit_user         (ChangedBy, ChangedAtUTC),
    INDEX idx_audit_record       (TableName, RecordID),
    INDEX idx_audit_operation    (Operation, ChangedAtUTC)
) ENGINE=InnoDB
COMMENT='Audit log table for compliance tracking'
PARTITION BY RANGE (UNIX_TIMESTAMP(ChangedAtUTC)) (
    PARTITION p_2024_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p_2024_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01')),
    PARTITION p_2024_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01')),
    PARTITION p_2024_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_2025_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2025-04-01')),
    PARTITION p_2025_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2025-07-01')),
    PARTITION p_2025_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2025-10-01')),
    PARTITION p_2025_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2026-01-01')),
    PARTITION p_2026_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
