-- Master Migration Script
-- Description: Runs all table enhancement migrations in correct order
-- Usage: mysql -u [username] -p < 000_run_all_migrations.sql

-- Set session timezone to UTC for consistency
SET @@session.time_zone = '+00:00';

-- Enable error handling
SET sql_mode = 'TRADITIONAL';

-- Display migration start
SELECT 'Starting database migrations...' AS Status;

-- Migration 001: Enhance Parties table
SELECT '001: Enhancing Parties table...' AS Status;
SOURCE 001_enhance_parties_table.sql;
SELECT '001: Parties table enhanced successfully' AS Status;

-- Migration 002: Enhance Ports table
SELECT '002: Enhancing Ports table...' AS Status;
SOURCE 002_enhance_ports_table.sql;
SELECT '002: Ports table enhanced successfully' AS Status;

-- Migration 003: Enhance CargoProfiles table
SELECT '003: Enhancing CargoProfiles table...' AS Status;
SOURCE 003_enhance_cargoprofiles_table.sql;
SELECT '003: CargoProfiles table enhanced successfully' AS Status;

-- Migration 004: Enhance Shipments table
SELECT '004: Enhancing Shipments table...' AS Status;
SOURCE 004_enhance_shipments_table.sql;
SELECT '004: Shipments table enhanced successfully' AS Status;

-- Migration 005: Enhance Ownership table
SELECT '005: Enhancing Ownership table...' AS Status;
SOURCE 005_enhance_ownership_table.sql;
SELECT '005: Ownership table enhanced successfully' AS Status;

-- Migration 006: Enhance AlarmEvents table
SELECT '006: Enhancing AlarmEvents table...' AS Status;
SOURCE 006_enhance_alarmevents_table.sql;
SELECT '006: AlarmEvents table enhanced successfully' AS Status;

-- Migration 007: Create AuditLog table
SELECT '007: Creating AuditLog table...' AS Status;
SOURCE 007_create_auditlog_table.sql;
SELECT '007: AuditLog table created successfully' AS Status;

-- Display completion message
SELECT 'All migrations completed successfully!' AS Status;
SELECT 'Database schema has been enhanced with new columns, indexes, and audit logging.' AS Status;
