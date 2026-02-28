-- Migration: 005_enhance_ownership_table.sql
-- Description: Add HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID, HandoverDocumentURL columns
-- Requirements: 5.1-5.6

USE supply_chain_sql;

-- Add HandoverCondition column - condition of cargo at handover
-- ENUM ensures only valid condition values
-- GOOD: Cargo in good condition, no issues
-- DAMAGED: Cargo has visible damage
-- PARTIAL: Only partial shipment received
-- Defaults to GOOD for normal handovers
ALTER TABLE Ownership 
ADD COLUMN HandoverCondition ENUM('GOOD','DAMAGED','PARTIAL') NOT NULL DEFAULT 'GOOD'
COMMENT 'Cargo condition at handover: GOOD (no issues), DAMAGED (visible damage), PARTIAL (incomplete)';

-- Add HandoverNotes column - detailed handover description
-- TEXT data type allows unlimited length for comprehensive notes
-- NULL permitted if no special notes needed
-- Example: "3 boxes received with minor dents on corners. Contents verified intact."
ALTER TABLE Ownership 
ADD COLUMN HandoverNotes TEXT NULL 
COMMENT 'Detailed handover notes and observations';

-- Add HandoverSignature column - digital signature hash
-- VARCHAR(255) sufficient for cryptographic hash values
-- NULL permitted if digital signature not used
-- Used for non-repudiation and authenticity verification
ALTER TABLE Ownership 
ADD COLUMN HandoverSignature VARCHAR(255) NULL 
COMMENT 'Digital signature hash for authenticity verification';

-- Add WitnessPartyID column - party who witnessed the handover
-- VARCHAR(32) matches PartyID format
-- NULL permitted if no witness present
-- Foreign key constraint ensures witness party exists
ALTER TABLE Ownership 
ADD COLUMN WitnessPartyID VARCHAR(32) NULL 
COMMENT 'Party ID of handover witness, NULL if no witness';

-- Add HandoverDocumentURL column - link to handover documentation
-- VARCHAR(512) sufficient for URLs
-- NULL permitted if no external documentation
-- Example: Link to signed PDF, photos, or external document management system
ALTER TABLE Ownership 
ADD COLUMN HandoverDocumentURL VARCHAR(512) NULL 
COMMENT 'URL to external handover documentation (PDF, photos, etc.)';

-- Add foreign key constraint for WitnessPartyID
-- Ensures witness party exists in Parties table
-- ON DELETE SET NULL: If witness party is deleted, set to NULL rather than blocking deletion
ALTER TABLE Ownership 
ADD CONSTRAINT fk_ownership_witness FOREIGN KEY (WitnessPartyID) REFERENCES Parties(PartyID) ON DELETE SET NULL;

-- Create index on HandoverCondition for filtering by condition
-- Common query pattern: "Find all handovers with damaged cargo"
CREATE INDEX idx_ownership_condition ON Ownership(HandoverCondition);
