-- Migration: 002_enhance_ports_table.sql
-- Description: Add Latitude, Longitude, Timezone, PortType, Status columns to Ports table
-- Requirements: 2.1-2.7

USE supply_chain_sql;

-- Add Latitude column - stores geographic latitude coordinate
-- DECIMAL(10,8) provides high precision: ±90 degrees with 8 decimal places
-- Example: 10.76245678 (Saigon Port)
-- NULL permitted as not all ports may have coordinates initially
ALTER TABLE Ports 
ADD COLUMN Latitude DECIMAL(10,8) NULL 
COMMENT 'Geographic latitude coordinate (±90 degrees, 8 decimal precision)';

-- Add Longitude column - stores geographic longitude coordinate
-- DECIMAL(11,8) provides high precision: ±180 degrees with 8 decimal places
-- Example: 106.68234567 (Saigon Port)
-- NULL permitted as not all ports may have coordinates initially
ALTER TABLE Ports 
ADD COLUMN Longitude DECIMAL(11,8) NULL 
COMMENT 'Geographic longitude coordinate (±180 degrees, 8 decimal precision)';

-- Add Timezone column - stores IANA timezone identifier
-- VARCHAR(64) sufficient for timezone names like 'Asia/Ho_Chi_Minh'
-- Used for accurate scheduling and time calculations
-- NULL permitted as timezone can be derived from coordinates if needed
ALTER TABLE Ports 
ADD COLUMN Timezone VARCHAR(64) NULL 
COMMENT 'IANA timezone identifier (e.g., Asia/Ho_Chi_Minh) for scheduling';

-- Add PortType column - categorizes the type of port facility
-- ENUM ensures only valid port types
-- SEAPORT: Maritime shipping port
-- AIRPORT: Air cargo facility
-- INLAND: Inland port or distribution center
ALTER TABLE Ports 
ADD COLUMN PortType ENUM('SEAPORT','AIRPORT','INLAND') NOT NULL DEFAULT 'SEAPORT'
COMMENT 'Port facility type: SEAPORT (maritime), AIRPORT (air cargo), INLAND (distribution center)';

-- Add Status column - tracks operational status of the port
-- ENUM ensures only valid status values
-- OPERATIONAL: Port is fully operational
-- CLOSED: Port is closed (weather, strikes, etc.)
-- RESTRICTED: Port has limited operations or restrictions
ALTER TABLE Ports 
ADD COLUMN Status ENUM('OPERATIONAL','CLOSED','RESTRICTED') NOT NULL DEFAULT 'OPERATIONAL'
COMMENT 'Operational status: OPERATIONAL (fully operational), CLOSED (not operational), RESTRICTED (limited operations)';

-- Create index on Country for efficient country-based queries
-- Common query pattern: "Find all ports in Vietnam"
CREATE INDEX idx_port_country ON Ports(Country);

-- Create composite index on Latitude and Longitude for geospatial queries
-- Used for: finding nearby ports, distance calculations, route planning
-- Composite index enables efficient range queries on coordinates
CREATE INDEX idx_port_location ON Ports(Latitude, Longitude);

-- Create index on Status for filtering operational ports
-- Common query pattern: "Find all operational ports"
CREATE INDEX idx_port_status ON Ports(Status);
