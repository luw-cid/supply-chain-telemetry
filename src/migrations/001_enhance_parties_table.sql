-- Migration: 001_enhance_parties_table.sql
-- Description: Add Email, Phone, Address, Status, UpdatedAtUTC columns to Parties table
-- Requirements: 1.1-1.6

USE supply_chain_sql;

-- Add Email column - stores contact email address for notifications and communications
-- VARCHAR(255) allows for long email addresses, NULL permitted as not all parties may have email
ALTER TABLE Parties 
ADD COLUMN Email VARCHAR(255) NULL COMMENT 'Contact email address for notifications and communications';

-- Add Phone column - stores contact phone number in international format (+country_code)
-- VARCHAR(32) sufficient for international phone numbers, NULL permitted
ALTER TABLE Parties 
ADD COLUMN Phone VARCHAR(32) NULL COMMENT 'Contact phone number in international format (+country_code)';

-- Add Address column - stores full company address
-- TEXT data type allows for multi-line addresses without length restrictions
ALTER TABLE Parties 
ADD COLUMN Address TEXT NULL COMMENT 'Full company address for correspondence';

-- Add Status column - tracks operational status of the party
-- ENUM ensures only valid status values, defaults to ACTIVE for new records
-- ACTIVE: Party is currently operational and can be assigned to shipments
-- INACTIVE: Party is temporarily not operational
-- SUSPENDED: Party has been suspended due to compliance or performance issues
ALTER TABLE Parties 
ADD COLUMN Status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE' 
COMMENT 'Operational status: ACTIVE (operational), INACTIVE (temporarily not operational), SUSPENDED (compliance/performance issues)';

-- Add UpdatedAtUTC column - automatically tracks when record was last modified
-- TIMESTAMP(6) provides microsecond precision for accurate audit trail
-- ON UPDATE CURRENT_TIMESTAMP(6) ensures automatic update on any modification
ALTER TABLE Parties 
ADD COLUMN UpdatedAtUTC TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
COMMENT 'Timestamp of last record modification, automatically updated';

-- Create composite index on PartyType and Status for efficient queries
-- Common query pattern: "Find all active logistics providers"
-- Composite index allows efficient filtering by both type and status
CREATE INDEX idx_party_type_status ON Parties(PartyType, Status);

-- Create index on Email for efficient email-based lookups
-- Used for: user authentication, notification delivery, duplicate detection
CREATE INDEX idx_party_email ON Parties(Email);
