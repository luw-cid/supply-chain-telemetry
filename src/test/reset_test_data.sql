-- ============================================================================
-- RESET TEST DATA: Clean and reseed for Chain of Custody API Test
-- ============================================================================
USE supply_chain_sql;

-- Clean up existing test data
DELETE FROM Ownership WHERE ShipmentID IN ('SHP-TRANSFER-OK', 'SHP-ALARM-001', 'SHP-HISTORY-001');
DELETE FROM Shipments WHERE ShipmentID IN ('SHP-TRANSFER-OK', 'SHP-ALARM-001', 'SHP-HISTORY-001');
DELETE FROM Users WHERE Email = 'testuser@custody.vn';

-- Reseed
-- ── 4. Shipments ──────────────────────────────────────────────────────────────
-- Insert shipments with NORMAL status first to avoid trigger blocking
INSERT INTO Shipments
  (ShipmentID, CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID,
   OriginPortCode, DestinationPortCode, Status, CurrentPortCode) VALUES
  ('SHP-TRANSFER-OK',  'CP-VACCINE-01', 500.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'VNHPH', 'IN_TRANSIT', 'VNSGN'),
  ('SHP-ALARM-001',    'CP-VACCINE-01', 200.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'SGSIN', 'NORMAL',     'VNSGN'),
  ('SHP-HISTORY-001',  'CP-VACCINE-01', 300.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNHPH', 'SGSIN', 'IN_TRANSIT', 'SGSIN');

-- ── 5. Ownership records ──────────────────────────────────────────────────────
INSERT INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition)
VALUES
  (UUID(), 'SHP-TRANSFER-OK', 'PARTY-LOG-001',
   '2026-03-01 08:00:00.000000', NULL, 'VNSGN', 'GOOD');

INSERT INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition)
VALUES
  (UUID(), 'SHP-ALARM-001', 'PARTY-LOG-001',
   '2026-03-05 10:00:00.000000', NULL, 'VNSGN', 'GOOD');

-- Now update SHP-ALARM-001 to ALARM status after ownership is created
UPDATE Shipments SET Status = 'ALARM' WHERE ShipmentID = 'SHP-ALARM-001';

INSERT INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC,
   HandoverPortCode, HandoverCondition, HandoverSignature)
VALUES
  (UUID(), 'SHP-HISTORY-001', 'PARTY-OWNER-001',
   '2026-03-01 06:00:00.000000', '2026-03-05 12:00:00.000000',
   'VNHPH', 'GOOD', 'sha256:aabbccddeeff001122334455'),

  (UUID(), 'SHP-HISTORY-001', 'PARTY-LOG-001',
   '2026-03-05 12:00:00.000000', '2026-03-10 18:00:00.000000',
   'VNSGN', 'GOOD', 'sha256:ddeeff001122334455aabbcc'),

  (UUID(), 'SHP-HISTORY-001', 'PARTY-LOG-002',
   '2026-03-10 18:00:00.000000', NULL,
   'SGSIN', 'GOOD', 'sha256:112233aabbccddeeff004455');

-- ── 6. Test User ──────────────────────────────────────────────────────────────
INSERT INTO Users
  (UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status)
VALUES (
  UUID(),
  'Test User Chain of Custody',
  'testuser@custody.vn',
  '+84901999999',
  '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
  'LOGISTICS',
  'PARTY-LOG-001',
  'ACTIVE'
);

SELECT 'Data reset complete!' AS status;
