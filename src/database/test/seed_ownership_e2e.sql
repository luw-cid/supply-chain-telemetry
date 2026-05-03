-- ============================================================================
-- Seed Ownership Data for E2E Testing
-- ============================================================================
-- Insert ownership records for SHP-E2E-001
-- Parties involved:
--   - PARTY-SHIPPER-01 (Global Trade Corp)
--   - PARTY-CONSIGN-01 (Vietnam Logistics Ltd)
-- Ports:
--   - VNSGN (Saigon Port - Origin)
--   - VNHPH (Hai Phong Port - Destination)
-- ============================================================================

USE supply_chain_sql;

-- Clear existing ownership data for SHP-E2E-001 (optional)
DELETE FROM Ownership WHERE ShipmentID = 'SHP-E2E-001';

-- Insert ownership records
INSERT INTO `ownership` (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID)
VALUES
  (
    UUID(),
    'SHP-E2E-001',
    'PARTY-SHIPPER-01',
    '2026-05-02 20:00:00.000000',
    '2026-05-02 22:30:00.000000',
    'VNSGN',
    'GOOD',
    'Vaccine shipment packed in temperature-controlled container. All seals intact.',
    'SIGNED_DIGITAL_001',
    NULL
  ),
  (
    UUID(),
    'SHP-E2E-001',
    'PARTY-CONSIGN-01',
    '2026-05-02 22:30:00.000000',
    NULL,
    'VNHPH',
    'GOOD',
    'In transit to Hai Phong Port. Monitoring temperature continuously.',
    NULL,
    NULL
  );

SELECT '✓ Ownership data seeded successfully for SHP-E2E-001' AS status;

-- Verify the data
SELECT 
  o.OwnershipID,
  o.ShipmentID,
  p.Name AS OwnerName,
  o.StartAtUTC,
  o.EndAtUTC,
  port.Name AS HandoverPort,
  o.HandoverCondition,
  o.HandoverNotes,
  CASE WHEN o.EndAtUTC IS NULL THEN 'ACTIVE' ELSE 'TRANSFERRED' END AS Status
FROM Ownership o
LEFT JOIN Parties p ON o.PartyID = p.PartyID
LEFT JOIN Ports port ON o.HandoverPortCode = port.PortCode
WHERE o.ShipmentID = 'SHP-E2E-001'
ORDER BY o.StartAtUTC ASC;
