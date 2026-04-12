-- ============================================================================
-- SEED DATA: Chain of Custody API Test
-- ============================================================================
-- Chạy file này trong MySQL Workbench hoặc CLI trước khi chạy test
-- mysql -u root -p supply_chain_sql < seed_test_custody.sql
-- ============================================================================

USE supply_chain_sql;

-- ── 1. Parties ────────────────────────────────────────────────────────────────
INSERT IGNORE INTO Parties (PartyID, PartyType, Name, Email, Phone, Status) VALUES
  ('PARTY-OWNER-001', 'OWNER',     'Vietnam Pharma Corp',   'vn@pharma.vn',  '+84901000001', 'ACTIVE'),
  ('PARTY-LOG-001',   'LOGISTICS', 'Saigon Logistics Co.',  'sg@log.vn',     '+84901000002', 'ACTIVE'),
  ('PARTY-LOG-002',   'LOGISTICS', 'Hanoi Freight Ltd.',    'hn@log.vn',     '+84901000003', 'ACTIVE'),
  ('PARTY-AUD-001',   'AUDITOR',   'Port Authority VNSGN',  'au@port.vn',    '+84901000004', 'ACTIVE');

-- ── 2. Ports ──────────────────────────────────────────────────────────────────
INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status) VALUES
  ('VNSGN', 'Saigon Port',     'Vietnam',    10.78330000, 106.70420000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('VNHPH', 'Hai Phong Port',  'Vietnam',    20.84490000, 106.68810000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('SGSIN', 'Singapore Port',  'Singapore',   1.29660000, 103.77640000, 'Asia/Singapore',   'OPERATIONAL');

-- ── 3. CargoProfile ───────────────────────────────────────────────────────────
INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax) VALUES
  ('CP-VACCINE-01', 'VACCINE', 'COVID-19 Vaccine', 2.00, 8.00);

-- ── 4. Shipments ──────────────────────────────────────────────────────────────
-- SHP-TRANSFER-OK  : Shipment IN_TRANSIT, owner hiện tại = PARTY-LOG-001
-- SHP-ALARM-001    : Shipment ALARM, dùng để test chặn transfer
-- SHP-HISTORY-001  : Shipment có 3-bước ownership chain (dùng cho test History)
INSERT IGNORE INTO Shipments
  (ShipmentID, CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID,
   OriginPortCode, DestinationPortCode, Status, CurrentPortCode) VALUES
  ('SHP-TRANSFER-OK',  'CP-VACCINE-01', 500.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'VNHPH', 'IN_TRANSIT', 'VNSGN'),
  ('SHP-ALARM-001',    'CP-VACCINE-01', 200.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'SGSIN', 'ALARM',      'VNSGN'),
  ('SHP-HISTORY-001',  'CP-VACCINE-01', 300.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNHPH', 'SGSIN', 'IN_TRANSIT', 'SGSIN');

-- ── 5. Ownership records ──────────────────────────────────────────────────────

-- SHP-TRANSFER-OK: PARTY-LOG-001 là chủ sở hữu hiện tại (EndAtUTC IS NULL)
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition)
VALUES
  (UUID(), 'SHP-TRANSFER-OK', 'PARTY-LOG-001',
   '2026-03-01 08:00:00.000000', NULL, 'VNSGN', 'GOOD');

-- SHP-ALARM-001: 1 ownership record active (để test 7.2 chain.length=1)
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition)
VALUES
  (UUID(), 'SHP-ALARM-001', 'PARTY-LOG-001',
   '2026-03-05 10:00:00.000000', NULL, 'VNSGN', 'GOOD');

-- SHP-HISTORY-001: 3-bước chain hoàn chỉnh
--   Bước 1: PARTY-OWNER-001 (đã kết thúc)
--   Bước 2: PARTY-LOG-001   (đã kết thúc)
--   Bước 3: PARTY-LOG-002   (đang active – EndAtUTC IS NULL)
INSERT IGNORE INTO Ownership
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
-- Email: testuser@custody.vn  |  Password: Password@123
-- PasswordHash = bcrypt('Password@123', 10)
-- PartyID = PARTY-LOG-001 (giúp test business rules với owner context)
INSERT IGNORE INTO Users
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

-- ── Xác nhận dữ liệu ─────────────────────────────────────────────────────────
SELECT 'Parties:'    AS tbl, COUNT(*) AS n FROM Parties    WHERE PartyID    IN ('PARTY-OWNER-001','PARTY-LOG-001','PARTY-LOG-002','PARTY-AUD-001')
UNION ALL
SELECT 'Ports:',       COUNT(*) FROM Ports       WHERE PortCode   IN ('VNSGN','VNHPH','SGSIN')
UNION ALL
SELECT 'Shipments:',   COUNT(*) FROM Shipments   WHERE ShipmentID IN ('SHP-TRANSFER-OK','SHP-ALARM-001','SHP-HISTORY-001')
UNION ALL
SELECT 'Ownership:',   COUNT(*) FROM Ownership   WHERE ShipmentID IN ('SHP-TRANSFER-OK','SHP-ALARM-001','SHP-HISTORY-001')
UNION ALL
SELECT 'Test User:',   COUNT(*) FROM Users        WHERE Email = 'testuser@custody.vn';
-- Expected: 4 | 3 | 3 | 5 | 1
