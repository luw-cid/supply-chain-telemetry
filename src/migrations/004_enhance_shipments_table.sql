-- Migration: 004_enhance_shipments_table.sql
-- Description: Add VolumeM3, EstimatedArrivalUTC, ActualArrivalUTC, InsuranceValue, Currency, TrackingDeviceID, ContainerNumber, SealNumber columns
--              Modify AlarmReason from VARCHAR(64) to VARCHAR(255)
-- Requirements: 4.1-4.12

USE supply_chain_sql;

-- Add VolumeM3 column - cargo volume in cubic meters
-- DECIMAL(10,2) allows large volumes with 2 decimal precision
-- NULL permitted as volume may not always be known
-- Used for capacity planning and space allocation
ALTER TABLE Shipments 
ADD COLUMN VolumeM3 DECIMAL(10,2) NULL 
COMMENT 'Cargo volume in cubic meters for capacity planning';

-- Add EstimatedArrivalUTC column - planned arrival timestamp
-- TIMESTAMP(6) provides microsecond precision
-- NULL permitted as ETA may not be available initially
-- Used for tracking and alerting on delays
ALTER TABLE Shipments 
ADD COLUMN EstimatedArrivalUTC TIMESTAMP(6) NULL 
COMMENT 'Estimated arrival timestamp for tracking and delay detection';

-- Add ActualArrivalUTC column - actual arrival timestamp
-- TIMESTAMP(6) provides microsecond precision
-- NULL until shipment is completed
-- Used for performance metrics and billing
ALTER TABLE Shipments 
ADD COLUMN ActualArrivalUTC TIMESTAMP(6) NULL 
COMMENT 'Actual arrival timestamp, NULL until shipment completed';

-- Add InsuranceValue column - declared insurance value
-- DECIMAL(15,2) allows large monetary amounts with 2 decimal precision
-- NULL permitted if no insurance or value not declared
-- Used for risk assessment and claims processing
ALTER TABLE Shipments 
ADD COLUMN InsuranceValue DECIMAL(15,2) NULL 
COMMENT 'Declared insurance value for risk assessment and claims';

-- Add Currency column - currency code for insurance value
-- VARCHAR(3) for ISO 4217 currency codes (USD, EUR, VND, etc.)
-- Defaults to USD as standard currency
ALTER TABLE Shipments 
ADD COLUMN Currency VARCHAR(3) NULL DEFAULT 'USD' 
COMMENT 'ISO 4217 currency code for insurance value (e.g., USD, EUR, VND)';

-- Add TrackingDeviceID column - IoT device identifier
-- VARCHAR(64) sufficient for device IDs
-- NULL permitted if no tracking device assigned
-- Used to link with telemetry data in MongoDB
ALTER TABLE Shipments 
ADD COLUMN TrackingDeviceID VARCHAR(64) NULL 
COMMENT 'IoT tracking device identifier for linking with telemetry data';

-- Add ContainerNumber column - shipping container identifier
-- VARCHAR(32) sufficient for container numbers like "MSCU1234567"
-- NULL permitted for non-containerized shipments
-- Used for container tracking and logistics coordination
ALTER TABLE Shipments 
ADD COLUMN ContainerNumber VARCHAR(32) NULL 
COMMENT 'Shipping container identifier (e.g., MSCU1234567)';

-- Add SealNumber column - tamper-evident seal identifier
-- VARCHAR(32) sufficient for seal numbers
-- NULL permitted if no seal applied
-- Used to verify cargo integrity and detect tampering
ALTER TABLE Shipments 
ADD COLUMN SealNumber VARCHAR(32) NULL 
COMMENT 'Tamper-evident seal identifier for integrity verification';

-- Modify AlarmReason column from VARCHAR(64) to VARCHAR(255)
-- Allows more detailed alarm descriptions
-- Existing data will be preserved
ALTER TABLE Shipments 
MODIFY COLUMN AlarmReason VARCHAR(255) NULL 
COMMENT 'Detailed alarm reason description (expanded from 64 to 255 chars)';

-- Create index on TrackingDeviceID for efficient device-based queries
-- Common query pattern: "Find shipment by tracking device ID"
CREATE INDEX idx_shipment_tracking_device ON Shipments(TrackingDeviceID);

-- Create index on ContainerNumber for efficient container-based queries
-- Common query pattern: "Find shipment by container number"
CREATE INDEX idx_shipment_container ON Shipments(ContainerNumber);

-- Create index on EstimatedArrivalUTC for time-based queries
-- Common query pattern: "Find shipments arriving in next 24 hours"
CREATE INDEX idx_shipment_eta ON Shipments(EstimatedArrivalUTC);

-- Create composite index on CargoType and Status for filtered queries
-- Common query pattern: "Find all in-transit vaccine shipments"
CREATE INDEX idx_shipment_cargo_status ON Shipments(CargoType, Status);
