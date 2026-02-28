-- Migration: 006_enhance_alarmevents_table.sql
-- Description: Add Severity, Status, AcknowledgedBy, AcknowledgedAtUTC, ResolvedBy, ResolvedAtUTC, ResolutionNotes columns
--              Modify AlarmType ENUM to include HUMIDITY_VIOLATION, ROUTE_DEVIATION, UNAUTHORIZED_ACCESS, DEVICE_MALFUNCTION
-- Requirements: 6.1-6.10

USE supply_chain_sql;

-- Add Severity column - alarm severity level
-- ENUM ensures only valid severity values
-- LOW: Minor issue, no immediate action required
-- MEDIUM: Moderate issue, should be addressed soon
-- HIGH: Serious issue, requires prompt attention
-- CRITICAL: Severe issue, requires immediate action
-- Defaults to MEDIUM as reasonable default
ALTER TABLE AlarmEvents 
ADD COLUMN Severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM'
COMMENT 'Alarm severity: LOW (minor), MEDIUM (moderate), HIGH (serious), CRITICAL (immediate action)';

-- Add Status column - alarm lifecycle status
-- ENUM ensures only valid status values
-- OPEN: Newly created, not yet acknowledged
-- ACKNOWLEDGED: Team aware, working on resolution
-- RESOLVED: Issue fixed and verified
-- FALSE_ALARM: Determined to be false positive
-- Defaults to OPEN for new alarms
ALTER TABLE AlarmEvents 
ADD COLUMN Status ENUM('OPEN','ACKNOWLEDGED','RESOLVED','FALSE_ALARM') NOT NULL DEFAULT 'OPEN'
COMMENT 'Alarm status: OPEN (new), ACKNOWLEDGED (in progress), RESOLVED (fixed), FALSE_ALARM (false positive)';

-- Add AcknowledgedBy column - user who acknowledged the alarm
-- VARCHAR(32) for user identifier
-- NULL until alarm is acknowledged
-- Used for accountability and tracking response times
ALTER TABLE AlarmEvents 
ADD COLUMN AcknowledgedBy VARCHAR(32) NULL 
COMMENT 'User identifier who acknowledged the alarm';

-- Add AcknowledgedAtUTC column - timestamp when alarm was acknowledged
-- TIMESTAMP(6) provides microsecond precision
-- NULL until alarm is acknowledged
-- Used for measuring response time metrics
ALTER TABLE AlarmEvents 
ADD COLUMN AcknowledgedAtUTC TIMESTAMP(6) NULL 
COMMENT 'Timestamp when alarm was acknowledged';

-- Add ResolvedBy column - user who resolved the alarm
-- VARCHAR(32) for user identifier
-- NULL until alarm is resolved
-- Used for accountability and performance tracking
ALTER TABLE AlarmEvents 
ADD COLUMN ResolvedBy VARCHAR(32) NULL 
COMMENT 'User identifier who resolved the alarm';

-- Add ResolvedAtUTC column - timestamp when alarm was resolved
-- TIMESTAMP(6) provides microsecond precision
-- NULL until alarm is resolved
-- Used for measuring resolution time metrics
ALTER TABLE AlarmEvents 
ADD COLUMN ResolvedAtUTC TIMESTAMP(6) NULL 
COMMENT 'Timestamp when alarm was resolved';

-- Add ResolutionNotes column - detailed resolution description
-- TEXT data type allows unlimited length for comprehensive notes
-- NULL until alarm is resolved
-- Example: "Temperature stabilized after refrigeration unit repair. Cargo verified intact."
ALTER TABLE AlarmEvents 
ADD COLUMN ResolutionNotes TEXT NULL 
COMMENT 'Detailed notes on how the alarm was resolved';

-- Modify AlarmType ENUM to include additional alarm types
-- Existing values: TEMP_VIOLATION, CHECKIN_TIMEOUT, MANUAL
-- New values: HUMIDITY_VIOLATION, ROUTE_DEVIATION, UNAUTHORIZED_ACCESS, DEVICE_MALFUNCTION
-- This expands alarm detection capabilities
ALTER TABLE AlarmEvents 
MODIFY COLUMN AlarmType ENUM(
    'TEMP_VIOLATION',           -- Temperature outside acceptable range
    'CHECKIN_TIMEOUT',          -- No check-in within expected timeframe
    'MANUAL',                   -- Manually created alarm
    'HUMIDITY_VIOLATION',       -- Humidity outside acceptable range
    'ROUTE_DEVIATION',          -- Shipment deviated from planned route
    'UNAUTHORIZED_ACCESS',      -- Unauthorized access to cargo detected
    'DEVICE_MALFUNCTION'        -- Tracking device malfunction or failure
) NOT NULL
COMMENT 'Type of alarm event';

-- Create composite index on Status and Severity for filtered queries
-- Common query pattern: "Find all open critical alarms"
CREATE INDEX idx_alarm_status_severity ON AlarmEvents(Status, Severity);

-- Create composite index on AcknowledgedBy and AcknowledgedAtUTC
-- Common query pattern: "Find all alarms acknowledged by user X in date range"
CREATE INDEX idx_alarm_acknowledged ON AlarmEvents(AcknowledgedBy, AcknowledgedAtUTC);

-- Create index on Status and AlarmAtUTC for finding unresolved alarms
-- Common query pattern: "Find all open/acknowledged alarms ordered by time"
CREATE INDEX idx_alarm_unresolved ON AlarmEvents(Status, AlarmAtUTC);
