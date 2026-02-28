-- Migration: 003_enhance_cargoprofiles_table.sql
-- Description: Add HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions, RequiresRefrigeration, HazardousClass columns
-- Requirements: 3.1-3.7

USE supply_chain_sql;

-- Add HumidityMin column - minimum acceptable humidity percentage
-- DECIMAL(5,2) allows values from 0.00 to 100.00 with 2 decimal precision
-- NULL permitted as not all cargo types have humidity requirements
ALTER TABLE CargoProfiles 
ADD COLUMN HumidityMin DECIMAL(5,2) NULL 
COMMENT 'Minimum acceptable humidity percentage (0.00-100.00)';

-- Add HumidityMax column - maximum acceptable humidity percentage
-- DECIMAL(5,2) allows values from 0.00 to 100.00 with 2 decimal precision
-- NULL permitted as not all cargo types have humidity requirements
-- Example: 60.00% for certain pharmaceuticals
ALTER TABLE CargoProfiles 
ADD COLUMN HumidityMax DECIMAL(5,2) NULL 
COMMENT 'Maximum acceptable humidity percentage (0.00-100.00)';

-- Add MaxTransitHours column - maximum allowed transit time
-- INTEGER data type for whole hours
-- NULL permitted if no time limit applies
-- Example: 72 hours for vaccines requiring rapid delivery
ALTER TABLE CargoProfiles 
ADD COLUMN MaxTransitHours INT NULL 
COMMENT 'Maximum allowed transit time in hours (NULL if no limit)';

-- Add HandlingInstructions column - detailed cargo handling guidelines
-- TEXT data type allows unlimited length for comprehensive instructions
-- NULL permitted if no special handling required
-- Example: "Keep upright. Do not shake. Protect from light."
ALTER TABLE CargoProfiles 
ADD COLUMN HandlingInstructions TEXT NULL 
COMMENT 'Detailed cargo handling guidelines and special instructions';

-- Add RequiresRefrigeration column - flag indicating refrigeration requirement
-- BOOLEAN (TINYINT(1)) for true/false value
-- Defaults to TRUE as most sensitive cargo requires refrigeration
-- Used for routing decisions and carrier selection
ALTER TABLE CargoProfiles 
ADD COLUMN RequiresRefrigeration BOOLEAN NOT NULL DEFAULT TRUE 
COMMENT 'Flag indicating if cargo requires refrigeration (TRUE/FALSE)';

-- Add HazardousClass column - UN hazardous material classification
-- VARCHAR(16) sufficient for UN codes like "UN2814"
-- NULL permitted for non-hazardous cargo
-- Example: "UN2814" for infectious substances
ALTER TABLE CargoProfiles 
ADD COLUMN HazardousClass VARCHAR(16) NULL 
COMMENT 'UN hazardous material classification code (e.g., UN2814), NULL if non-hazardous';

-- Add CHECK constraint to ensure HumidityMin < HumidityMax when both are provided
-- This prevents invalid humidity ranges
ALTER TABLE CargoProfiles 
ADD CONSTRAINT chk_cargo_humidity CHECK (
    HumidityMin IS NULL OR 
    HumidityMax IS NULL OR 
    HumidityMin < HumidityMax
);

-- Create index on RequiresRefrigeration for filtering cargo by refrigeration needs
-- Common query pattern: "Find all cargo profiles requiring refrigeration"
CREATE INDEX idx_cargo_refrigeration ON CargoProfiles(RequiresRefrigeration);
