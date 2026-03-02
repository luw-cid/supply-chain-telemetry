-- ============================================================================
-- MySQL Index Creation Script
-- ============================================================================
-- Description: Tạo indexes tối ưu cho Trace Route queries
-- Author: Senior Database Engineer
-- Created: 2026-03-01
-- ============================================================================
-- 
-- USAGE:
-- mysql -u root -p supply_chain_sql < src/database/sql/create_indexes.sql
-- 
-- hoặc trong MySQL client:
-- source src/database/sql/create_indexes.sql;
-- ============================================================================

USE supply_chain_sql;

-- ============================================================================
-- SECTION 1: Shipments Table Indexes
-- ============================================================================

-- INDEX 1.1: Status + UpdatedAtUTC (cho dashboard queries)
-- Purpose: Filter active shipments, sort by recent updates
-- Query: SELECT * FROM Shipments WHERE Status = 'IN_TRANSIT' ORDER BY UpdatedAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipment_status_updated 
ON Shipments(Status, UpdatedAtUTC);

-- INDEX 1.2: Origin + Destination (cho route analytics)
-- Purpose: Find shipments between specific ports
-- Query: SELECT * FROM Shipments WHERE OriginPortCode = 'VNSGN' AND DestinationPortCode = 'USNYC'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipment_origin_dest 
ON Shipments(OriginPortCode, DestinationPortCode);

-- INDEX 1.3: Tracking Device ID (cho device queries)
-- Purpose: Find shipment by IoT device
-- Query: SELECT * FROM Shipments WHERE TrackingDeviceID = 'DEV-12345'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_device 
ON Shipments(TrackingDeviceID);

-- INDEX 1.4: Cargo Profile + Status (cho cargo analytics)
-- Purpose: Analyze shipments by cargo type
-- Query: SELECT * FROM Shipments WHERE CargoProfileID = 'VAC_COVID19' AND Status = 'IN_TRANSIT'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipment_cargo_status 
ON Shipments(CargoProfileID, Status);

-- INDEX 1.5: Last Check-in Time (cho stale data detection)
-- Purpose: Find shipments with old telemetry
-- Query: SELECT * FROM Shipments WHERE LastCheckInAtUTC < DATE_SUB(NOW(), INTERVAL 24 HOUR)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipment_last_checkin 
ON Shipments(LastCheckInAtUTC);

-- ============================================================================
-- SECTION 2: Ownership Table Indexes
-- ============================================================================

-- INDEX 2.1: Shipment + EndAtUTC (CRITICAL cho chain of custody)
-- Purpose: Get ownership history for a shipment
-- Query: SELECT * FROM Ownership WHERE ShipmentID = 'SHP-001' ORDER BY StartAtUTC
-- Benefits:
--   - Covering index cho WHERE + ORDER BY
--   - Fast range scan
--   - Used by SP_TraceRouteContext
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ownership_shipment_end 
ON Ownership(ShipmentID, EndAtUTC);

-- INDEX 2.2: Party + StartAtUTC (cho party analytics)
-- Purpose: Get all shipments handled by a party
-- Query: SELECT * FROM Ownership WHERE PartyID = 'PARTY-001' ORDER BY StartAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ownership_party_start 
ON Ownership(PartyID, StartAtUTC);

-- INDEX 2.3: Handover Condition (cho quality analytics)
-- Purpose: Find damaged handovers
-- Query: SELECT * FROM Ownership WHERE HandoverCondition != 'GOOD'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ownership_condition 
ON Ownership(HandoverCondition);

-- INDEX 2.4: Active Shipment ID (UNIQUE constraint)
-- Purpose: Ensure only one active owner per shipment
-- Note: Already created as UNIQUE KEY in schema
-- ============================================================================
-- UNIQUE KEY uq_ownership_active (ActiveShipmentID)

-- ============================================================================
-- SECTION 3: AlarmEvents Table Indexes
-- ============================================================================

-- INDEX 3.1: Shipment + AlarmAtUTC (CRITICAL cho alarm history)
-- Purpose: Get alarm history for a shipment
-- Query: SELECT * FROM AlarmEvents WHERE ShipmentID = 'SHP-001' ORDER BY AlarmAtUTC DESC
-- Benefits:
--   - Fast range scan
--   - Used by SP_TraceRouteContext
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alarm_shipment_at 
ON AlarmEvents(ShipmentID, AlarmAtUTC);

-- INDEX 3.2: AlarmType + AlarmAtUTC (cho alarm analytics)
-- Purpose: Analyze alarms by type over time
-- Query: SELECT * FROM AlarmEvents WHERE AlarmType = 'TEMP_VIOLATION' ORDER BY AlarmAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alarm_type_at 
ON AlarmEvents(AlarmType, AlarmAtUTC);

-- INDEX 3.3: Status + Severity (cho open alarms dashboard)
-- Purpose: Find critical open alarms
-- Query: SELECT * FROM AlarmEvents WHERE Status = 'OPEN' AND Severity = 'CRITICAL'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alarm_status_severity 
ON AlarmEvents(Status, Severity);

-- INDEX 3.4: Acknowledged By + Time (cho user analytics)
-- Purpose: Track alarm response by user
-- Query: SELECT * FROM AlarmEvents WHERE AcknowledgedBy = 'USER-001' ORDER BY AcknowledgedAtUTC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alarm_acknowledged 
ON AlarmEvents(AcknowledgedBy, AcknowledgedAtUTC);

-- INDEX 3.5: Unresolved Alarms (cho monitoring)
-- Purpose: Find old unresolved alarms
-- Query: SELECT * FROM AlarmEvents WHERE Status = 'OPEN' ORDER BY AlarmAtUTC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alarm_unresolved 
ON AlarmEvents(Status, AlarmAtUTC);

-- ============================================================================
-- SECTION 4: Parties Table Indexes
-- ============================================================================

-- INDEX 4.1: PartyType + Status (cho party filtering)
-- Purpose: Find active logistics providers
-- Query: SELECT * FROM Parties WHERE PartyType = 'LOGISTICS' AND Status = 'ACTIVE'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_party_type_status 
ON Parties(PartyType, Status);

-- INDEX 4.2: Email (cho user lookup)
-- Purpose: Find party by email
-- Query: SELECT * FROM Parties WHERE Email = 'contact@company.com'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_party_email 
ON Parties(Email);

-- ============================================================================
-- SECTION 5: Ports Table Indexes
-- ============================================================================

-- INDEX 5.1: Country (cho geographic filtering)
-- Purpose: Find all ports in a country
-- Query: SELECT * FROM Ports WHERE Country = 'Vietnam'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_port_country 
ON Ports(Country);

-- INDEX 5.2: Geospatial Location (cho proximity queries)
-- Purpose: Find nearby ports
-- Query: SELECT * FROM Ports WHERE Latitude BETWEEN ... AND Longitude BETWEEN ...
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_port_location 
ON Ports(Latitude, Longitude);

-- INDEX 5.3: Status (cho operational ports)
-- Purpose: Filter operational ports
-- Query: SELECT * FROM Ports WHERE Status = 'OPERATIONAL'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_port_status 
ON Ports(Status);

-- ============================================================================
-- SECTION 6: AuditLog Table Indexes
-- ============================================================================

-- INDEX 6.1: TableName + ChangedAtUTC (cho audit queries)
-- Purpose: Get audit trail for a table
-- Query: SELECT * FROM AuditLog WHERE TableName = 'Shipments' ORDER BY ChangedAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_table_time 
ON AuditLog(TableName, ChangedAtUTC);

-- INDEX 6.2: ChangedBy + ChangedAtUTC (cho user audit)
-- Purpose: Track changes by user
-- Query: SELECT * FROM AuditLog WHERE ChangedBy = 'USER-001' ORDER BY ChangedAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_user 
ON AuditLog(ChangedBy, ChangedAtUTC);

-- INDEX 6.3: TableName + RecordID (cho record history)
-- Purpose: Get full history of a specific record
-- Query: SELECT * FROM AuditLog WHERE TableName = 'Shipments' AND RecordID = 'SHP-001'
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_record 
ON AuditLog(TableName, RecordID);

-- INDEX 6.4: Operation + ChangedAtUTC (cho operation analytics)
-- Purpose: Analyze operations over time
-- Query: SELECT * FROM AuditLog WHERE Operation = 'DELETE' ORDER BY ChangedAtUTC DESC
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_operation 
ON AuditLog(Operation, ChangedAtUTC);

-- ============================================================================
-- SECTION 7: Verify Indexes
-- ============================================================================

-- Show all indexes for each table
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    INDEX_TYPE,
    CARDINALITY
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql'
  AND TABLE_NAME IN ('Shipments', 'Ownership', 'AlarmEvents', 'Parties', 'Ports', 'AuditLog')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================================
-- SECTION 8: Index Statistics
-- ============================================================================

-- Show table sizes and index sizes
SELECT 
    TABLE_NAME,
    ROUND(DATA_LENGTH / 1024 / 1024, 2) AS 'Data Size (MB)',
    ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS 'Index Size (MB)',
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS 'Total Size (MB)',
    TABLE_ROWS AS 'Estimated Rows'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'supply_chain_sql'
  AND TABLE_NAME IN ('Shipments', 'Ownership', 'AlarmEvents', 'Parties', 'Ports', 'AuditLog')
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- ============================================================================
-- SECTION 9: Performance Recommendations
-- ============================================================================

-- Check for unused indexes (requires MySQL 5.7+)
-- Note: Run this after system has been in production for a while
SELECT 
    OBJECT_SCHEMA,
    OBJECT_NAME,
    INDEX_NAME
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE INDEX_NAME IS NOT NULL
  AND COUNT_STAR = 0
  AND OBJECT_SCHEMA = 'supply_chain_sql'
ORDER BY OBJECT_NAME, INDEX_NAME;

-- ============================================================================
-- SECTION 10: Maintenance Commands
-- ============================================================================

-- Analyze tables to update index statistics
ANALYZE TABLE Shipments, Ownership, AlarmEvents, Parties, Ports, AuditLog;

-- Optimize tables (defragment, rebuild indexes)
-- WARNING: This locks the table, run during maintenance window
-- OPTIMIZE TABLE Shipments, Ownership, AlarmEvents, Parties, Ports, AuditLog;

-- ============================================================================
-- END OF INDEX CREATION SCRIPT
-- ============================================================================

-- Summary
SELECT 
    'Index creation completed!' AS Status,
    COUNT(*) AS 'Total Indexes Created'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql'
  AND INDEX_NAME != 'PRIMARY';
