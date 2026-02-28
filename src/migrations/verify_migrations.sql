-- Verification Script for Database Migrations
-- Description: Checks that all columns and indexes were created successfully
-- Usage: mysql -u [username] -p supply_chain_sql < verify_migrations.sql

USE supply_chain_sql;

SELECT '========================================' AS '';
SELECT 'MIGRATION VERIFICATION REPORT' AS '';
SELECT '========================================' AS '';
SELECT '' AS '';

-- Verify Parties table enhancements
SELECT '1. PARTIES TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 5 THEN '✓ PASS: All 5 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 5 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Parties'
  AND COLUMN_NAME IN ('Email', 'Phone', 'Address', 'Status', 'UpdatedAtUTC');

SELECT 
    CASE 
        WHEN COUNT(*) >= 2 THEN '✓ PASS: Required indexes exist'
        ELSE CONCAT('✗ FAIL: Expected 2+ indexes, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Parties'
  AND INDEX_NAME IN ('idx_party_type_status', 'idx_party_email');

SELECT '' AS '';

-- Verify Ports table enhancements
SELECT '2. PORTS TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 5 THEN '✓ PASS: All 5 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 5 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Ports'
  AND COLUMN_NAME IN ('Latitude', 'Longitude', 'Timezone', 'PortType', 'Status');

SELECT 
    CASE 
        WHEN COUNT(*) >= 3 THEN '✓ PASS: Required indexes exist'
        ELSE CONCAT('✗ FAIL: Expected 3+ indexes, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Ports'
  AND INDEX_NAME IN ('idx_port_country', 'idx_port_location', 'idx_port_status');

SELECT '' AS '';

-- Verify CargoProfiles table enhancements
SELECT '3. CARGOPROFILES TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 6 THEN '✓ PASS: All 6 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 6 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'CargoProfiles'
  AND COLUMN_NAME IN ('HumidityMin', 'HumidityMax', 'MaxTransitHours', 'HandlingInstructions', 'RequiresRefrigeration', 'HazardousClass');

SELECT 
    CASE 
        WHEN COUNT(*) >= 1 THEN '✓ PASS: chk_cargo_humidity constraint exists'
        ELSE '✗ FAIL: chk_cargo_humidity constraint not found'
    END AS Status
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'CargoProfiles'
  AND CONSTRAINT_NAME = 'chk_cargo_humidity';

SELECT '' AS '';

-- Verify Shipments table enhancements
SELECT '4. SHIPMENTS TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 8 THEN '✓ PASS: All 8 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 8 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Shipments'
  AND COLUMN_NAME IN ('VolumeM3', 'EstimatedArrivalUTC', 'ActualArrivalUTC', 'InsuranceValue', 'Currency', 'TrackingDeviceID', 'ContainerNumber', 'SealNumber');

SELECT 
    CASE 
        WHEN CHARACTER_MAXIMUM_LENGTH = 255 THEN '✓ PASS: AlarmReason expanded to VARCHAR(255)'
        ELSE CONCAT('✗ FAIL: AlarmReason is VARCHAR(', CHARACTER_MAXIMUM_LENGTH, ')')
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Shipments'
  AND COLUMN_NAME = 'AlarmReason';

SELECT 
    CASE 
        WHEN COUNT(*) >= 4 THEN '✓ PASS: Required indexes exist'
        ELSE CONCAT('✗ FAIL: Expected 4+ indexes, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Shipments'
  AND INDEX_NAME IN ('idx_shipment_tracking_device', 'idx_shipment_container', 'idx_shipment_eta', 'idx_shipment_cargo_status');

SELECT '' AS '';

-- Verify Ownership table enhancements
SELECT '5. OWNERSHIP TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 5 THEN '✓ PASS: All 5 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 5 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Ownership'
  AND COLUMN_NAME IN ('HandoverCondition', 'HandoverNotes', 'HandoverSignature', 'WitnessPartyID', 'HandoverDocumentURL');

SELECT 
    CASE 
        WHEN COUNT(*) >= 1 THEN '✓ PASS: fk_ownership_witness constraint exists'
        ELSE '✗ FAIL: fk_ownership_witness constraint not found'
    END AS Status
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'Ownership'
  AND CONSTRAINT_NAME = 'fk_ownership_witness';

SELECT '' AS '';

-- Verify AlarmEvents table enhancements
SELECT '6. ALARMEVENTS TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 7 THEN '✓ PASS: All 7 new columns exist'
        ELSE CONCAT('✗ FAIL: Expected 7 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AlarmEvents'
  AND COLUMN_NAME IN ('Severity', 'Status', 'AcknowledgedBy', 'AcknowledgedAtUTC', 'ResolvedBy', 'ResolvedAtUTC', 'ResolutionNotes');

SELECT 
    CASE 
        WHEN COLUMN_TYPE LIKE '%HUMIDITY_VIOLATION%' 
         AND COLUMN_TYPE LIKE '%ROUTE_DEVIATION%'
         AND COLUMN_TYPE LIKE '%UNAUTHORIZED_ACCESS%'
         AND COLUMN_TYPE LIKE '%DEVICE_MALFUNCTION%'
        THEN '✓ PASS: AlarmType ENUM expanded with 4 new values'
        ELSE '✗ FAIL: AlarmType ENUM not properly expanded'
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AlarmEvents'
  AND COLUMN_NAME = 'AlarmType';

SELECT 
    CASE 
        WHEN COUNT(*) >= 3 THEN '✓ PASS: Required indexes exist'
        ELSE CONCAT('✗ FAIL: Expected 3+ indexes, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AlarmEvents'
  AND INDEX_NAME IN ('idx_alarm_status_severity', 'idx_alarm_acknowledged', 'idx_alarm_unresolved');

SELECT '' AS '';

-- Verify AuditLog table creation
SELECT '7. AUDITLOG TABLE' AS '';
SELECT '----------------------------------------' AS '';
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✓ PASS: AuditLog table exists'
        ELSE '✗ FAIL: AuditLog table not found'
    END AS Status
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AuditLog';

SELECT 
    CASE 
        WHEN COUNT(*) = 10 THEN '✓ PASS: All 10 columns exist'
        ELSE CONCAT('✗ FAIL: Expected 10 columns, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AuditLog'
  AND COLUMN_NAME IN ('AuditID', 'TableName', 'Operation', 'RecordID', 'OldValue', 'NewValue', 'ChangedBy', 'ChangedAtUTC', 'ClientIP', 'UserAgent');

SELECT 
    CASE 
        WHEN COUNT(*) >= 4 THEN '✓ PASS: Required indexes exist'
        ELSE CONCAT('✗ FAIL: Expected 4+ indexes, found ', COUNT(*))
    END AS Status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AuditLog'
  AND INDEX_NAME IN ('idx_audit_table_time', 'idx_audit_user', 'idx_audit_record', 'idx_audit_operation');

SELECT 
    CASE 
        WHEN COUNT(*) >= 1 THEN '✓ PASS: Table is partitioned'
        ELSE '✗ FAIL: Table partitioning not found'
    END AS Status
FROM INFORMATION_SCHEMA.PARTITIONS
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AuditLog'
  AND PARTITION_NAME IS NOT NULL;

SELECT '' AS '';

-- Summary
SELECT '========================================' AS '';
SELECT 'SUMMARY' AS '';
SELECT '========================================' AS '';
SELECT CONCAT('Total new columns added: ', 
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'supply_chain_sql' 
     AND TABLE_NAME IN ('Parties', 'Ports', 'CargoProfiles', 'Shipments', 'Ownership', 'AlarmEvents')
     AND COLUMN_NAME IN ('Email', 'Phone', 'Address', 'Status', 'UpdatedAtUTC',
                         'Latitude', 'Longitude', 'Timezone', 'PortType',
                         'HumidityMin', 'HumidityMax', 'MaxTransitHours', 'HandlingInstructions', 'RequiresRefrigeration', 'HazardousClass',
                         'VolumeM3', 'EstimatedArrivalUTC', 'ActualArrivalUTC', 'InsuranceValue', 'Currency', 'TrackingDeviceID', 'ContainerNumber', 'SealNumber',
                         'HandoverCondition', 'HandoverNotes', 'HandoverSignature', 'WitnessPartyID', 'HandoverDocumentURL',
                         'Severity', 'AcknowledgedBy', 'AcknowledgedAtUTC', 'ResolvedBy', 'ResolvedAtUTC', 'ResolutionNotes'))
) AS '';

SELECT CONCAT('Total new indexes added: ',
    (SELECT COUNT(DISTINCT INDEX_NAME) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'supply_chain_sql' 
     AND INDEX_NAME IN ('idx_party_type_status', 'idx_party_email',
                        'idx_port_country', 'idx_port_location', 'idx_port_status',
                        'idx_cargo_refrigeration',
                        'idx_shipment_tracking_device', 'idx_shipment_container', 'idx_shipment_eta', 'idx_shipment_cargo_status',
                        'idx_ownership_condition',
                        'idx_alarm_status_severity', 'idx_alarm_acknowledged', 'idx_alarm_unresolved'))
) AS '';

SELECT '' AS '';
SELECT 'Verification complete!' AS '';
