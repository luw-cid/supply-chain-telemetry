-- Migration: 007_create_auditlog_table.sql
-- Description: Create AuditLog table for compliance tracking with partitioning by timestamp
-- Requirements: 16.1-16.6

USE supply_chain_sql;

-- Create AuditLog table to track all critical data modifications for compliance
-- This table provides a complete audit trail of changes to tracked tables
-- Partitioned by ChangedAtUTC for efficient querying and maintenance of large datasets
CREATE TABLE IF NOT EXISTS AuditLog (
    -- Auto-increment ID for audit record - primary key
    AuditID BIGINT NOT NULL AUTO_INCREMENT,
    
    -- Name of the table that was modified (e.g., "Shipments", "Ownership")
    -- VARCHAR(64) sufficient for table names, NOT NULL as every audit must reference a table
    TableName VARCHAR(64) NOT NULL COMMENT 'Name of the table that was modified',
    
    -- Type of operation performed: INSERT, UPDATE, or DELETE
    -- ENUM ensures only valid operation types are recorded
    Operation ENUM('INSERT','UPDATE','DELETE') NOT NULL COMMENT 'Type of database operation performed',
    
    -- ID of the record that was modified
    -- Stored as VARCHAR(64) for flexibility with different primary key types (INT, VARCHAR, UUID)
    RecordID VARCHAR(64) NOT NULL COMMENT 'Primary key value of the modified record',
    
    -- Previous state of the record before modification
    -- Stored as JSON for flexible structure that can accommodate any table schema
    -- NULL for INSERT operations (no previous state)
    OldValue JSON NULL COMMENT 'Record state before modification (NULL for INSERT)',
    
    -- New state of the record after modification
    -- Stored as JSON for flexible structure that can accommodate any table schema
    -- NULL for DELETE operations (no new state)
    NewValue JSON NULL COMMENT 'Record state after modification (NULL for DELETE)',
    
    -- User or system identifier that performed the change
    -- VARCHAR(64) accommodates user IDs, system identifiers like "SYSTEM", "TRIGGER", etc.
    ChangedBy VARCHAR(64) NOT NULL COMMENT 'User ID or system identifier that performed the change',
    
    -- Timestamp when the change occurred
    -- TIMESTAMP(6) provides microsecond precision for accurate audit trail
    -- Defaults to current timestamp for automatic recording
    ChangedAtUTC TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Timestamp when the change occurred',
    
    -- IP address of the client that performed the change
    -- VARCHAR(45) accommodates both IPv4 (15 chars) and IPv6 (45 chars max)
    -- NULL permitted as some changes may be system-initiated without client IP
    ClientIP VARCHAR(45) NULL COMMENT 'IP address of the client (supports IPv4 and IPv6)',
    
    -- User agent string to identify the application or browser
    -- VARCHAR(255) sufficient for most user agent strings
    -- NULL permitted as some changes may be system-initiated
    UserAgent VARCHAR(255) NULL COMMENT 'User agent string identifying the application or browser',
    
    PRIMARY KEY (AuditID, ChangedAtUTC)
) ENGINE=InnoDB
COMMENT='Audit log table tracking all critical data modifications for compliance'
-- Partition by RANGE on ChangedAtUTC for performance with large datasets
-- Partitioning improves query performance and enables efficient data archival
-- Each partition represents a quarter (3 months) of data
PARTITION BY RANGE (UNIX_TIMESTAMP(ChangedAtUTC)) (
    PARTITION p_2024_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01 00:00:00')) COMMENT '2024 Q1 data',
    PARTITION p_2024_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2024-07-01 00:00:00')) COMMENT '2024 Q2 data',
    PARTITION p_2024_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2024-10-01 00:00:00')) COMMENT '2024 Q3 data',
    PARTITION p_2024_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01 00:00:00')) COMMENT '2024 Q4 data',
    PARTITION p_2025_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2025-04-01 00:00:00')) COMMENT '2025 Q1 data',
    PARTITION p_2025_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2025-07-01 00:00:00')) COMMENT '2025 Q2 data',
    PARTITION p_2025_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2025-10-01 00:00:00')) COMMENT '2025 Q3 data',
    PARTITION p_2025_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2026-01-01 00:00:00')) COMMENT '2025 Q4 data',
    PARTITION p_2026_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01 00:00:00')) COMMENT '2026 Q1 data',
    PARTITION p_future VALUES LESS THAN MAXVALUE COMMENT 'Future data beyond defined partitions'
);

-- Create composite index on TableName and ChangedAtUTC for efficient queries
-- Common query pattern: "Show all changes to Shipments table in the last 30 days"
-- TableName first allows filtering by table, then ChangedAtUTC for time-based filtering
CREATE INDEX idx_audit_table_time ON AuditLog(TableName, ChangedAtUTC)
COMMENT 'Composite index for querying changes by table and time range';

-- Create composite index on ChangedBy and ChangedAtUTC for user activity tracking
-- Common query pattern: "Show all changes made by user X in the last week"
-- ChangedBy first allows filtering by user, then ChangedAtUTC for time-based filtering
CREATE INDEX idx_audit_user ON AuditLog(ChangedBy, ChangedAtUTC)
COMMENT 'Composite index for tracking user activity over time';

-- Create composite index on TableName and RecordID for record-specific audit trail
-- Common query pattern: "Show complete history of changes to Shipment SHP-001"
-- Allows efficient retrieval of all changes to a specific record
CREATE INDEX idx_audit_record ON AuditLog(TableName, RecordID)
COMMENT 'Composite index for retrieving complete change history of a specific record';

-- Create composite index on Operation and ChangedAtUTC for operation-type analysis
-- Common query pattern: "Show all DELETE operations in the last month"
-- Operation first allows filtering by operation type, then ChangedAtUTC for time-based filtering
CREATE INDEX idx_audit_operation ON AuditLog(Operation, ChangedAtUTC)
COMMENT 'Composite index for analyzing operations by type over time';
