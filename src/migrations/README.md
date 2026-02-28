# Database Migration Scripts

This directory contains SQL migration scripts to enhance the MySQL database schema for the Global Supply Chain & Asset Telemetry system.

## Overview

These migrations add new columns, indexes, and constraints to existing tables to support enhanced functionality including:
- Contact information and status tracking for parties
- Geographic coordinates and operational status for ports
- Humidity controls and handling instructions for cargo profiles
- Volume, insurance, and tracking device information for shipments
- Digital signatures and witness tracking for ownership transfers
- Severity levels and resolution tracking for alarm events

## Migration Files

| File | Description | Requirements |
|------|-------------|--------------|
| `001_enhance_parties_table.sql` | Add Email, Phone, Address, Status, UpdatedAtUTC columns | 1.1-1.6 |
| `002_enhance_ports_table.sql` | Add Latitude, Longitude, Timezone, PortType, Status columns | 2.1-2.7 |
| `003_enhance_cargoprofiles_table.sql` | Add humidity, transit time, handling, refrigeration columns | 3.1-3.7 |
| `004_enhance_shipments_table.sql` | Add volume, arrival times, insurance, tracking device columns | 4.1-4.12 |
| `005_enhance_ownership_table.sql` | Add handover condition, notes, signature, witness columns | 5.1-5.6 |
| `006_enhance_alarmevents_table.sql` | Add severity, status, acknowledgment, resolution columns | 6.1-6.10 |
| `007_create_auditlog_table.sql` | Create AuditLog table with partitioning for compliance tracking | 16.1-16.6 |

## Running Migrations

### Prerequisites

1. MySQL 8.0 or higher
2. Database user with ALTER TABLE privileges
3. Backup of existing database (recommended)

### Option 1: Run All Migrations at Once

```bash
cd src/migrations
mysql -u [username] -p supply_chain_sql < 000_run_all_migrations.sql
```

### Option 2: Run Individual Migrations

```bash
cd src/migrations
mysql -u [username] -p supply_chain_sql < 001_enhance_parties_table.sql
mysql -u [username] -p supply_chain_sql < 002_enhance_ports_table.sql
mysql -u [username] -p supply_chain_sql < 003_enhance_cargoprofiles_table.sql
mysql -u [username] -p supply_chain_sql < 004_enhance_shipments_table.sql
mysql -u [username] -p supply_chain_sql < 005_enhance_ownership_table.sql
mysql -u [username] -p supply_chain_sql < 006_enhance_alarmevents_table.sql
mysql -u [username] -p supply_chain_sql < 007_create_auditlog_table.sql
```

### Option 3: Using MySQL Workbench

1. Open MySQL Workbench
2. Connect to your database
3. Open each migration file
4. Execute the script
5. Verify results in the output panel

## Rollback

⚠️ **WARNING**: Rollback will drop columns and indexes. Data in dropped columns will be lost!

### Before Rollback

1. **Backup your database**:
   ```bash
   mysqldump -u [username] -p supply_chain_sql > backup_before_rollback.sql
   ```

2. **Verify no critical data** exists in columns to be dropped

### Execute Rollback

```bash
cd src/migrations
mysql -u [username] -p supply_chain_sql < 999_rollback_all_migrations.sql
```

## Verification

After running migrations, verify the changes:

```sql
-- Check Parties table structure
DESCRIBE Parties;

-- Check Ports table structure
DESCRIBE Ports;

-- Check CargoProfiles table structure
DESCRIBE CargoProfiles;

-- Check Shipments table structure
DESCRIBE Shipments;

-- Check Ownership table structure
DESCRIBE Ownership;

-- Check AlarmEvents table structure
DESCRIBE AlarmEvents;

-- Check AuditLog table structure
DESCRIBE AuditLog;

-- Verify indexes
SHOW INDEX FROM Parties;
SHOW INDEX FROM Ports;
SHOW INDEX FROM CargoProfiles;
SHOW INDEX FROM Shipments;
SHOW INDEX FROM Ownership;
SHOW INDEX FROM AlarmEvents;

-- Verify AuditLog table partitions
SELECT 
    PARTITION_NAME, 
    PARTITION_DESCRIPTION, 
    TABLE_ROWS 
FROM INFORMATION_SCHEMA.PARTITIONS 
WHERE TABLE_SCHEMA = 'supply_chain_sql' 
  AND TABLE_NAME = 'AuditLog';
```

## Migration Order

Migrations must be run in numerical order (001 → 007) because:
- Each migration is independent and modifies a single table or creates a new table
- No dependencies exist between migrations
- However, running in order ensures consistent state

## Impact Assessment

### Parties Table
- **New columns**: 5 (Email, Phone, Address, Status, UpdatedAtUTC)
- **New indexes**: 2 (PartyType+Status, Email)
- **Breaking changes**: None (all new columns are nullable or have defaults)

### Ports Table
- **New columns**: 5 (Latitude, Longitude, Timezone, PortType, Status)
- **New indexes**: 3 (Country, Location, Status)
- **Breaking changes**: None (all new columns are nullable or have defaults)

### CargoProfiles Table
- **New columns**: 6 (HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions, RequiresRefrigeration, HazardousClass)
- **New constraints**: 1 (HumidityMin < HumidityMax)
- **New indexes**: 1 (RequiresRefrigeration)
- **Breaking changes**: None (all new columns are nullable or have defaults)

### Shipments Table
- **New columns**: 8 (VolumeM3, EstimatedArrivalUTC, ActualArrivalUTC, InsuranceValue, Currency, TrackingDeviceID, ContainerNumber, SealNumber)
- **Modified columns**: 1 (AlarmReason: VARCHAR(64) → VARCHAR(255))
- **New indexes**: 4 (TrackingDeviceID, ContainerNumber, EstimatedArrivalUTC, CargoType+Status)
- **Breaking changes**: None (all new columns are nullable or have defaults)

### Ownership Table
- **New columns**: 5 (HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID, HandoverDocumentURL)
- **New constraints**: 1 (Foreign key for WitnessPartyID)
- **New indexes**: 1 (HandoverCondition)
- **Breaking changes**: None (all new columns are nullable or have defaults)

### AlarmEvents Table
- **New columns**: 7 (Severity, Status, AcknowledgedBy, AcknowledgedAtUTC, ResolvedBy, ResolvedAtUTC, ResolutionNotes)
- **Modified columns**: 1 (AlarmType: expanded ENUM with 4 new values)
- **New indexes**: 3 (Status+Severity, AcknowledgedBy+AcknowledgedAtUTC, Status+AlarmAtUTC)
- **Breaking changes**: None (all new columns have defaults, ENUM expansion is backward compatible)

### AuditLog Table
- **New table**: AuditLog (compliance tracking)
- **Columns**: 10 (AuditID, TableName, Operation, RecordID, OldValue, NewValue, ChangedBy, ChangedAtUTC, ClientIP, UserAgent)
- **Partitioning**: RANGE partitioning by ChangedAtUTC (quarterly partitions)
- **New indexes**: 4 (TableName+ChangedAtUTC, ChangedBy+ChangedAtUTC, TableName+RecordID, Operation+ChangedAtUTC)
- **Breaking changes**: None (new table)

## Performance Considerations

- **Index creation** may take time on large tables (especially Shipments, AlarmEvents)
- **Estimated downtime**: 1-5 minutes depending on table sizes
- **Recommendation**: Run during maintenance window
- **Lock behavior**: ALTER TABLE acquires metadata locks; concurrent reads/writes will be blocked

## Testing

After migration, test the following:

1. **Insert operations**: Verify new columns accept data
2. **Query performance**: Test queries using new indexes
3. **Constraint validation**: Test CHECK constraints and foreign keys
4. **Application compatibility**: Ensure existing application code works with new schema

## Troubleshooting

### Error: "Duplicate column name"
- **Cause**: Migration already run
- **Solution**: Check if columns exist before re-running

### Error: "Cannot add foreign key constraint"
- **Cause**: Referenced data doesn't exist
- **Solution**: Ensure Parties table has valid data before adding WitnessPartyID constraint

### Error: "Check constraint is violated"
- **Cause**: Existing data violates new constraint
- **Solution**: Clean up data before adding constraint

## Support

For issues or questions:
1. Check the design document: `.kiro/specs/database-improvements/design.md`
2. Review requirements: `.kiro/specs/database-improvements/requirements.md`
3. Consult the DBA or development team

## Version History

- **v1.0** (2024): Initial migration scripts for database enhancements
  - Added 31 new columns across 6 tables
  - Added 14 new indexes for query optimization
  - Added 2 new constraints for data integrity
- **v1.1** (2024): Added AuditLog table for compliance
  - Created AuditLog table with 10 columns
  - Implemented quarterly partitioning for performance
  - Added 4 indexes for efficient audit queries
