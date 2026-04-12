-- ============================================================================
-- UI demo: one shipment + multi-step ownership for "Chuỗi sở hữu (tổng quan)"
-- INSERT IGNORE — safe to re-run.
--
-- Prerequisite: schema applied (mysql.sql).
-- Strongly recommended: run seed_test_custody.sql first so Parties / CargoProfiles /
-- base Ports exist (PARTY-OWNER-001, PARTY-LOG-001, PARTY-LOG-002, CP-VACCINE-01, VNSGN, VNHPH, SGSIN).
-- Optional: run ../seed-data/ports_extra.sql for more port codes in dropdowns.
--
-- mysql -u root -p YOUR_DB < src/database/test/seed_ui_chain_demo.sql
-- ============================================================================

-- Shipment: VNSGN -> SGSIN (ports from base seed / seed_test_custody)
INSERT IGNORE INTO Shipments
  (ShipmentID, CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID,
   OriginPortCode, DestinationPortCode, Status, CurrentPortCode)
VALUES
  ('SHP-UI-DEMO-01', 'CP-VACCINE-01', 120.50, 'PARTY-OWNER-001', 'PARTY-LOG-002',
   'VNSGN', 'SGSIN', 'IN_TRANSIT', 'VNSGN');

-- 3-step chain; last row active (EndAtUTC NULL). Fixed OwnershipIDs for idempotency.
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverSignature)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'SHP-UI-DEMO-01', 'PARTY-OWNER-001',
   '2026-02-01 08:00:00.000000', '2026-02-10 10:00:00.000000',
   'VNSGN', 'GOOD', NULL),
  ('11111111-1111-4111-8111-111111111102', 'SHP-UI-DEMO-01', 'PARTY-LOG-001',
   '2026-02-10 10:00:00.000000', '2026-02-18 14:30:00.000000',
   'VNHPH', 'GOOD', 'sha256:ui_demo_step2'),
  ('11111111-1111-4111-8111-111111111103', 'SHP-UI-DEMO-01', 'PARTY-LOG-002',
   '2026-02-18 14:30:00.000000', NULL,
   'SGSIN', 'GOOD', NULL);

SELECT 'SHP-UI-DEMO-01 shipments' AS chk, COUNT(*) AS n FROM Shipments WHERE ShipmentID = 'SHP-UI-DEMO-01'
UNION ALL
SELECT 'SHP-UI-DEMO-01 ownership', COUNT(*) FROM Ownership WHERE ShipmentID = 'SHP-UI-DEMO-01';
