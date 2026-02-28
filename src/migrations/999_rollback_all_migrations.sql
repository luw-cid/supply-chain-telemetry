-- Rollback Script for All Migrations
-- Description: Reverts all table enhancements (use with caution - data loss may occur)
-- Usage: mysql -u [username] -p < 999_rollback_all_migrations.sql
-- WARNING: This will drop columns and indexes. Backup your data first!

USE supply_chain_sql;

SET @@session.time_zone = '+00:00';

SELECT 'WARNING: Starting rollback of all migrations...' AS Status;
SELECT 'This will remove columns and indexes added by migrations 001-007' AS Status;

-- Rollback 007: AuditLog table
SELECT 'Rolling back AuditLog table creation...' AS Status;

DROP TABLE IF EXISTS AuditLog;

SELECT 'AuditLog table dropped' AS Status;

-- Rollback 006: AlarmEvents table
SELECT 'Rolling back AlarmEvents table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_alarm_status_severity ON AlarmEvents;
DROP INDEX IF EXISTS idx_alarm_acknowledged ON AlarmEvents;
DROP INDEX IF EXISTS idx_alarm_unresolved ON AlarmEvents;

ALTER TABLE AlarmEvents 
MODIFY COLUMN AlarmType ENUM('TEMP_VIOLATION','CHECKIN_TIMEOUT','MANUAL') NOT NULL;

ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS ResolutionNotes;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS ResolvedAtUTC;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS ResolvedBy;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS AcknowledgedAtUTC;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS AcknowledgedBy;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS Status;
ALTER TABLE AlarmEvents DROP COLUMN IF EXISTS Severity;

SELECT 'AlarmEvents table rolled back' AS Status;

-- Rollback 005: Ownership table
SELECT 'Rolling back Ownership table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_ownership_condition ON Ownership;
ALTER TABLE Ownership DROP FOREIGN KEY IF EXISTS fk_ownership_witness;

ALTER TABLE Ownership DROP COLUMN IF EXISTS HandoverDocumentURL;
ALTER TABLE Ownership DROP COLUMN IF EXISTS WitnessPartyID;
ALTER TABLE Ownership DROP COLUMN IF EXISTS HandoverSignature;
ALTER TABLE Ownership DROP COLUMN IF EXISTS HandoverNotes;
ALTER TABLE Ownership DROP COLUMN IF EXISTS HandoverCondition;

SELECT 'Ownership table rolled back' AS Status;

-- Rollback 004: Shipments table
SELECT 'Rolling back Shipments table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_shipment_tracking_device ON Shipments;
DROP INDEX IF EXISTS idx_shipment_container ON Shipments;
DROP INDEX IF EXISTS idx_shipment_eta ON Shipments;
DROP INDEX IF EXISTS idx_shipment_cargo_status ON Shipments;

ALTER TABLE Shipments MODIFY COLUMN AlarmReason VARCHAR(64) NULL;

ALTER TABLE Shipments DROP COLUMN IF EXISTS SealNumber;
ALTER TABLE Shipments DROP COLUMN IF EXISTS ContainerNumber;
ALTER TABLE Shipments DROP COLUMN IF EXISTS TrackingDeviceID;
ALTER TABLE Shipments DROP COLUMN IF EXISTS Currency;
ALTER TABLE Shipments DROP COLUMN IF EXISTS InsuranceValue;
ALTER TABLE Shipments DROP COLUMN IF EXISTS ActualArrivalUTC;
ALTER TABLE Shipments DROP COLUMN IF EXISTS EstimatedArrivalUTC;
ALTER TABLE Shipments DROP COLUMN IF EXISTS VolumeM3;

SELECT 'Shipments table rolled back' AS Status;

-- Rollback 003: CargoProfiles table
SELECT 'Rolling back CargoProfiles table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_cargo_refrigeration ON CargoProfiles;
ALTER TABLE CargoProfiles DROP CONSTRAINT IF EXISTS chk_cargo_humidity;

ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS HazardousClass;
ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS RequiresRefrigeration;
ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS HandlingInstructions;
ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS MaxTransitHours;
ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS HumidityMax;
ALTER TABLE CargoProfiles DROP COLUMN IF EXISTS HumidityMin;

SELECT 'CargoProfiles table rolled back' AS Status;

-- Rollback 002: Ports table
SELECT 'Rolling back Ports table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_port_country ON Ports;
DROP INDEX IF EXISTS idx_port_location ON Ports;
DROP INDEX IF EXISTS idx_port_status ON Ports;

ALTER TABLE Ports DROP COLUMN IF EXISTS Status;
ALTER TABLE Ports DROP COLUMN IF EXISTS PortType;
ALTER TABLE Ports DROP COLUMN IF EXISTS Timezone;
ALTER TABLE Ports DROP COLUMN IF EXISTS Longitude;
ALTER TABLE Ports DROP COLUMN IF EXISTS Latitude;

SELECT 'Ports table rolled back' AS Status;

-- Rollback 001: Parties table
SELECT 'Rolling back Parties table enhancements...' AS Status;

DROP INDEX IF EXISTS idx_party_type_status ON Parties;
DROP INDEX IF EXISTS idx_party_email ON Parties;

ALTER TABLE Parties DROP COLUMN IF EXISTS UpdatedAtUTC;
ALTER TABLE Parties DROP COLUMN IF EXISTS Status;
ALTER TABLE Parties DROP COLUMN IF EXISTS Address;
ALTER TABLE Parties DROP COLUMN IF EXISTS Phone;
ALTER TABLE Parties DROP COLUMN IF EXISTS Email;

SELECT 'Parties table rolled back' AS Status;

SELECT 'All migrations have been rolled back successfully!' AS Status;
SELECT 'Database schema has been reverted to original state.' AS Status;
