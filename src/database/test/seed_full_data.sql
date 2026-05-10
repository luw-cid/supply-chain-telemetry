-- ============================================================================
-- SEED DATA FULL: Supply Chain Telemetry System
-- Database: supply_chain_sql (MariaDB 10.4)
-- Mô tả: Dữ liệu mẫu đầy đủ, logic hợp lệ cho tất cả các bảng
-- Chạy: mysql -u root -p supply_chain_sql < seed_full_data.sql
-- ============================================================================

USE supply_chain_sql;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. PARTIES  (OWNER / LOGISTICS / AUDITOR)
-- ============================================================================
INSERT IGNORE INTO Parties (PartyID, PartyType, Name, Email, Phone, Address, Status) VALUES
  -- Chủ hàng (OWNER)
  ('PARTY-OWN-001', 'OWNER',     'Vietnam Pharma Corp',       'contact@vnpharma.vn',    '+84901000001', '12 Nguyen Hue, Q1, TP.HCM',    'ACTIVE'),
  ('PARTY-OWN-002', 'OWNER',     'Mekong Seafood JSC',        'info@mekongseafood.vn',  '+84901000002', '45 Tran Hung Dao, Can Tho',     'ACTIVE'),
  ('PARTY-OWN-003', 'OWNER',     'Hanoi Electronics Ltd',     'export@hanoitech.vn',    '+84901000003', '99 Kim Ma, Ba Dinh, Ha Noi',    'ACTIVE'),

  -- Logistics / Forwarder (LOGISTICS)
  ('PARTY-LOG-001', 'LOGISTICS', 'Saigon Logistics Co.',      'ops@saigonlog.vn',       '+84901000010', '88 Ham Nghi, Q1, TP.HCM',      'ACTIVE'),
  ('PARTY-LOG-002', 'LOGISTICS', 'Hanoi Freight Ltd.',        'freight@hanoilog.vn',    '+84901000011', '23 Trang Tien, Hoan Kiem, HN',  'ACTIVE'),
  ('PARTY-LOG-003', 'LOGISTICS', 'Singapore Express Pte.',    'ops@sgexpress.sg',       '+6562000001',  '10 Pasir Panjang Rd, Singapore','ACTIVE'),
  ('PARTY-LOG-004', 'LOGISTICS', 'PenEx Logistics Sdn.',      'ops@penex.my',           '+60421000001', '1 Bayan Lepas FIZ, Penang, MY', 'ACTIVE'),

  -- Kiểm toán / Cảng vụ (AUDITOR)
  ('PARTY-AUD-001', 'AUDITOR',   'Port Authority VNSGN',      'audit@portsgn.gov.vn',   '+84838000001', 'Khu cang Sai Gon, Q4, TP.HCM', 'ACTIVE'),
  ('PARTY-AUD-002', 'AUDITOR',   'Port Authority VNHPH',      'audit@porthph.gov.vn',   '+84225000001', 'Cang Hai Phong, HP',            'ACTIVE'),
  ('PARTY-AUD-003', 'AUDITOR',   'MPA Singapore',             'audit@mpa.gov.sg',       '+6562272220',  '460 Alexandra Rd, Singapore',   'ACTIVE');

-- ============================================================================
-- 2. PORTS
-- ============================================================================
INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status) VALUES
  ('VNSGN', 'Saigon Port (Ho Chi Minh City)', 'Vietnam',    10.78330000, 106.70420000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('VNHPH', 'Hai Phong Port',                 'Vietnam',    20.84490000, 106.68810000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('VNDAD', 'Da Nang Port',                   'Vietnam',    16.09800000, 108.23400000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('SGSIN', 'Port of Singapore (PSA)',         'Singapore',   1.29660000, 103.77640000, 'Asia/Singapore',   'OPERATIONAL'),
  ('MYPNG', 'Penang Port',                    'Malaysia',    5.41640000, 100.33270000, 'Asia/Kuala_Lumpur','OPERATIONAL'),
  ('THBKK', 'Laem Chabang Port',              'Thailand',   13.09390000, 100.92000000, 'Asia/Bangkok',     'OPERATIONAL'),
  ('IDJKT', 'Tanjung Priok (Jakarta)',         'Indonesia',  -6.10780000, 106.88340000, 'Asia/Jakarta',     'OPERATIONAL');

-- ============================================================================
-- 3. CARGO PROFILES
-- ============================================================================
INSERT IGNORE INTO CargoProfiles
  (CargoProfileID, CargoType, CargoName, TempMin, TempMax,
   HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions) VALUES
  ('CP-VACCINE-01',  'VACCINE',      'COVID-19 mRNA Vaccine',     2.00,   8.00, 30.00, 60.00,  72, 'Keep upright. No dry ice contact.'),
  ('CP-FROZEN-01',   'FROZEN_FOOD',  'Frozen Shrimp (IQF)',      -20.00, -15.00,  NULL,  NULL, 120, 'Do not refreeze once thawed.'),
  ('CP-CHILLED-01',  'CHILLED_FOOD', 'Chilled Pangasius Fillet',   0.00,   4.00, 85.00, 95.00,  48, 'Handle with care. Maintain cold chain.'),
  ('CP-ELEC-01',     'ELECTRONICS',  'Consumer Electronics',      10.00,  35.00, 20.00, 70.00, 240, 'ESD protection required. Keep dry.'),
  ('CP-CHEMICAL-01', 'CHEMICAL',     'Industrial Solvent (HAZ)',   5.00,  30.00,  NULL,  NULL, 168, 'Flammable. IMDG Class 3. Ventilated container.');

-- ============================================================================
-- 4. DEVICES (IoT Sensors)
-- ============================================================================
INSERT IGNORE INTO Devices
  (DeviceID, DeviceName, DeviceType, Status, FirmwareVer, LastPingAtUTC, Metadata) VALUES
  ('DEV-IOT-001', 'TempLogger Alpha 001', 'IOT_SENSOR', 'ACTIVE', 'v2.3.1', '2026-05-10 04:30:00', '{"model":"TL-A1","battery_pct":87}'),
  ('DEV-IOT-002', 'TempLogger Alpha 002', 'IOT_SENSOR', 'ACTIVE', 'v2.3.1', '2026-05-10 04:28:00', '{"model":"TL-A1","battery_pct":72}'),
  ('DEV-IOT-003', 'TempLogger Beta 001',  'IOT_SENSOR', 'ACTIVE', 'v3.0.0', '2026-05-10 04:25:00', '{"model":"TL-B1","battery_pct":95}'),
  ('DEV-IOT-004', 'TempLogger Beta 002',  'IOT_SENSOR', 'ACTIVE', 'v3.0.0', '2026-05-10 04:20:00', '{"model":"TL-B1","battery_pct":61}'),
  ('DEV-IOT-005', 'ColdChain Pro 001',    'IOT_SENSOR', 'ACTIVE', 'v4.1.2', '2026-05-10 04:15:00', '{"model":"CC-P1","battery_pct":100}'),
  ('DEV-IOT-006', 'ColdChain Pro 002',    'IOT_SENSOR', 'MAINTENANCE', 'v4.0.9', NULL,             '{"model":"CC-P1","battery_pct":0}'),
  ('DEV-IOT-007', 'MultiSensor G7',       'IOT_SENSOR', 'ACTIVE', 'v1.8.5', '2026-05-10 04:10:00', '{"model":"MS-G7","battery_pct":55}');

-- ============================================================================
-- 5. SHIPMENTS
-- Luật: ShipperPartyID phải là OWNER, ConsigneePartyID bất kỳ
--       OriginPort != DestinationPort
--       CurrentPortCode hợp lệ với hành trình
-- ============================================================================
INSERT IGNORE INTO Shipments
  (ShipmentID, CargoProfileID, WeightKg, VolumeM3,
   ShipperPartyID, ConsigneePartyID,
   OriginPortCode, DestinationPortCode,
   Status, CurrentPortCode, TrackingDeviceID,
   LastTelemetryAtUTC, LastTelemetryStatus, LastCheckInAtUTC)
VALUES
  -- SHP-001: Vaccine VNSGN→SGSIN, đang IN_TRANSIT, OK
  ('SHP-001', 'CP-VACCINE-01',  500.00, 2.50,
   'PARTY-OWN-001', 'PARTY-LOG-003',
   'VNSGN', 'SGSIN',
   'IN_TRANSIT', 'VNSGN', 'DEV-IOT-001',
   '2026-05-10 04:00:00', 'OK', '2026-05-10 04:00:00'),

  -- SHP-002: Frozen Shrimp VNHPH→SGSIN, đang ALARM (temp violation)
  ('SHP-002', 'CP-FROZEN-01',   300.00, 5.00,
   'PARTY-OWN-002', 'PARTY-LOG-003',
   'VNHPH', 'SGSIN',
   'ALARM', 'VNHPH', 'DEV-IOT-002',
   '2026-05-09 22:00:00', 'VIOLATION', '2026-05-09 20:00:00'),

  -- SHP-003: Chilled Fish VNSGN→MYPNG, NORMAL (chưa xuất phát)
  ('SHP-003', 'CP-CHILLED-01',  200.00, 4.00,
   'PARTY-OWN-002', 'PARTY-LOG-004',
   'VNSGN', 'MYPNG',
   'NORMAL', 'VNSGN', 'DEV-IOT-003',
   NULL, 'UNKNOWN', NULL),

  -- SHP-004: Electronics VNDAD→THBKK, IN_TRANSIT, OK
  ('SHP-004', 'CP-ELEC-01',    1200.00, 8.00,
   'PARTY-OWN-003', 'PARTY-LOG-002',
   'VNDAD', 'THBKK',
   'IN_TRANSIT', 'VNDAD', 'DEV-IOT-004',
   '2026-05-10 03:45:00', 'OK', '2026-05-10 03:45:00'),

  -- SHP-005: Vaccine VNHPH→SGSIN→IDJKT (đã completed)
  ('SHP-005', 'CP-VACCINE-01',  750.00, 3.50,
   'PARTY-OWN-001', 'PARTY-LOG-003',
   'VNHPH', 'IDJKT',
   'COMPLETED', 'IDJKT', NULL,
   '2026-04-25 10:00:00', 'OK', '2026-04-25 10:00:00'),

  -- SHP-006: Chemical VNSGN→MYPNG, IN_TRANSIT, VIOLATION tele nhưng chưa ALARM
  ('SHP-006', 'CP-CHEMICAL-01',  800.00, 6.00,
   'PARTY-OWN-003', 'PARTY-LOG-001',
   'VNSGN', 'MYPNG',
   'IN_TRANSIT', 'SGSIN', 'DEV-IOT-007',
   '2026-05-10 02:00:00', 'VIOLATION', '2026-05-10 02:00:00');

-- Gán device cho shipment (update AssignedShipmentID)
UPDATE Devices SET AssignedShipmentID = 'SHP-001' WHERE DeviceID = 'DEV-IOT-001';
UPDATE Devices SET AssignedShipmentID = 'SHP-002' WHERE DeviceID = 'DEV-IOT-002';
UPDATE Devices SET AssignedShipmentID = 'SHP-003' WHERE DeviceID = 'DEV-IOT-003';
UPDATE Devices SET AssignedShipmentID = 'SHP-004' WHERE DeviceID = 'DEV-IOT-004';
UPDATE Devices SET AssignedShipmentID = 'SHP-006' WHERE DeviceID = 'DEV-IOT-007';

-- ============================================================================
-- 6. OWNERSHIP (Chain of Custody)
-- Luật:
--   • Mỗi shipment chỉ có ĐúNG MỘT bản ghi EndAtUTC IS NULL (active)
--   • EndAtUTC >= StartAtUTC
--   • ActiveShipmentID là generated column → không insert
--   • UNIQUE INDEX uq_ownership_active đảm bảo chỉ 1 active / shipment
-- ============================================================================

-- ── SHP-001: PARTY-OWN-001 → PARTY-LOG-001 (đang active) ──────────────────
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID)
VALUES
  (UUID(), 'SHP-001', 'PARTY-OWN-001',
   '2026-05-08 07:00:00', '2026-05-08 09:00:00',
   'VNSGN', 'GOOD', 'Bàn giao tại kho lạnh A3.',
   'sha256:aabb001122334455aabbccdd', 'PARTY-AUD-001'),

  (UUID(), 'SHP-001', 'PARTY-LOG-001',
   '2026-05-08 09:00:00', NULL,
   'VNSGN', 'GOOD', 'Nhận hàng, đang vận chuyển.',
   NULL, NULL);

-- ── SHP-002: PARTY-OWN-002 → PARTY-LOG-002 (đang active, trạng thái ALARM) ─
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID)
VALUES
  (UUID(), 'SHP-002', 'PARTY-OWN-002',
   '2026-05-07 06:00:00', '2026-05-07 08:00:00',
   'VNHPH', 'GOOD', 'Xuất kho lạnh Hai Phong.',
   'sha256:bbcc112233445566bbccddee', 'PARTY-AUD-002'),

  (UUID(), 'SHP-002', 'PARTY-LOG-002',
   '2026-05-07 08:00:00', NULL,
   'VNHPH', 'GOOD', 'Đang vận chuyển - ALARM nhiệt độ vượt ngưỡng.',
   NULL, NULL);

-- ── SHP-003: PARTY-OWN-002 đang active (NORMAL, chưa giao) ───────────────
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes)
VALUES
  (UUID(), 'SHP-003', 'PARTY-OWN-002',
   '2026-05-10 08:00:00', NULL,
   'VNSGN', 'GOOD', 'Chờ xuất cảng.');

-- ── SHP-004: PARTY-OWN-003 → PARTY-LOG-002 (đang active) ─────────────────
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature)
VALUES
  (UUID(), 'SHP-004', 'PARTY-OWN-003',
   '2026-05-09 10:00:00', '2026-05-09 12:00:00',
   'VNDAD', 'GOOD', 'Bàn giao tại cảng Da Nang.',
   'sha256:ccdd223344556677ccddee00'),

  (UUID(), 'SHP-004', 'PARTY-LOG-002',
   '2026-05-09 12:00:00', NULL,
   'VNDAD', 'GOOD', 'Đang chạy tuyến Da Nang → Laem Chabang.',
   NULL);

-- ── SHP-005: Chain 3 bước đã COMPLETED ────────────────────────────────────
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID)
VALUES
  -- Bước 1: Owner → Log-001 tại VNHPH
  (UUID(), 'SHP-005', 'PARTY-OWN-001',
   '2026-04-20 06:00:00', '2026-04-20 09:00:00',
   'VNHPH', 'GOOD', 'Xuất kho, bàn giao Saigon Logistics.',
   'sha256:ee1122334455667788aabb00', 'PARTY-AUD-002'),

  -- Bước 2: Log-001 → Log-003 tại SGSIN
  (UUID(), 'SHP-005', 'PARTY-LOG-001',
   '2026-04-20 09:00:00', '2026-04-22 14:00:00',
   'SGSIN', 'GOOD', 'Transit Singapore, bàn giao SG Express.',
   'sha256:ff223344556677889900bbcc', 'PARTY-AUD-003'),

  -- Bước 3: Log-003 → đích IDJKT (đã kết thúc khi COMPLETED)
  (UUID(), 'SHP-005', 'PARTY-LOG-003',
   '2026-04-22 14:00:00', '2026-04-25 10:00:00',
   'IDJKT', 'GOOD', 'Giao hàng thành công tại Jakarta.',
   'sha256:00334455667788990011ccdd', NULL);

-- ── SHP-006: PARTY-OWN-003 → PARTY-LOG-001 → PARTY-LOG-003 (active tại SGSIN)
INSERT IGNORE INTO Ownership
  (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverNotes, HandoverSignature, WitnessPartyID)
VALUES
  (UUID(), 'SHP-006', 'PARTY-OWN-003',
   '2026-05-06 08:00:00', '2026-05-06 10:00:00',
   'VNSGN', 'GOOD', 'Bàn giao tại Saigon Port.',
   'sha256:aabb334455667788aabbccdd', 'PARTY-AUD-001'),

  (UUID(), 'SHP-006', 'PARTY-LOG-001',
   '2026-05-06 10:00:00', '2026-05-08 18:00:00',
   'SGSIN', 'GOOD', 'Transit Singapore, bàn giao tiếp.',
   'sha256:bbcc445566778899bbccddee', 'PARTY-AUD-003'),

  (UUID(), 'SHP-006', 'PARTY-LOG-003',
   '2026-05-08 18:00:00', NULL,
   'SGSIN', 'GOOD', 'Đang vận chuyển tới Penang.',
   NULL, NULL);

-- ============================================================================
-- 7. ALARM EVENTS
-- Luật: ShipmentID phải tồn tại, AlarmType phải hợp lệ
--       SHP-002 đang ALARM nên phải có alarm OPEN
-- ============================================================================
INSERT IGNORE INTO AlarmEvents
  (AlarmEventID, ShipmentID, AlarmType, Severity, Status, AlarmReason, AlarmAtUTC, Source)
VALUES
  -- SHP-002: Nhiệt độ vượt ngưỡng, OPEN (chưa xử lý)
  (UUID(), 'SHP-002', 'TEMP_VIOLATION', 'HIGH', 'OPEN',
   'Temp recorded -25.3°C, below min threshold -20°C.',
   '2026-05-09 22:05:00', 'SQL_TRIGGER'),

  -- SHP-001: Timeout checkin nhỏ, đã RESOLVED
  (UUID(), 'SHP-001', 'CHECKIN_TIMEOUT', 'LOW', 'RESOLVED',
   'Device did not check in for 8 hours.',
   '2026-05-08 18:00:00', 'BATCH_SCAN'),

  -- SHP-006: Temp vi phạm nhỏ, ACKNOWLEDGED
  (UUID(), 'SHP-006', 'TEMP_VIOLATION', 'MEDIUM', 'ACKNOWLEDGED',
   'Temp 32°C briefly exceeded max 30°C for chemical cargo.',
   '2026-05-10 02:10:00', 'SQL_TRIGGER');

-- ============================================================================
-- 8. USERS
-- Passwords (bcrypt 10 rounds):
--   Admin      → "Admin@12345"   hash: $2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG
--   Logistics  → "Password@123"  hash: $2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG
-- (Dùng cùng hash placeholder – thay bằng hash thực khi cần)
-- ============================================================================
INSERT IGNORE INTO Users (UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status)
VALUES
  -- ADMIN (không thuộc party nào)
  (UUID(), 'System Admin',           'admin@supplychain.vn',     '+84900000001',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'ADMIN', NULL, 'ACTIVE'),

  -- OWNER users
  (UUID(), 'Nguyen Van An (Pharma)', 'an.nguyen@vnpharma.vn',    '+84901000001',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'OWNER', 'PARTY-OWN-001', 'ACTIVE'),

  (UUID(), 'Tran Thi Bich (Seafood)','bich.tran@mekongseafood.vn','+84901000002',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'OWNER', 'PARTY-OWN-002', 'ACTIVE'),

  (UUID(), 'Le Minh Duc (Electronics)','duc.le@hanoitech.vn',    '+84901000003',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'OWNER', 'PARTY-OWN-003', 'ACTIVE'),

  -- LOGISTICS users
  (UUID(), 'Pham Quoc Bao (SGLog)',  'bao.pham@saigonlog.vn',    '+84901000010',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'LOGISTICS', 'PARTY-LOG-001', 'ACTIVE'),

  (UUID(), 'Hoang Thi Thu (HNFreight)','thu.hoang@hanoilog.vn',  '+84901000011',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'LOGISTICS', 'PARTY-LOG-002', 'ACTIVE'),

  -- AUDITOR user
  (UUID(), 'Vo Van Khai (Port Auth)', 'khai.vo@portsgn.gov.vn',  '+84838000001',
   '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
   'AUDITOR', 'PARTY-AUD-001', 'ACTIVE');

-- ============================================================================
-- 9. KIỂM TRA DỮ LIỆU SAU KHI SEED
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;

SELECT '=== VERIFICATION ===' AS info;
SELECT 'Parties'     AS tbl, COUNT(*) AS n FROM Parties
UNION ALL
SELECT 'Ports',        COUNT(*) FROM Ports
UNION ALL
SELECT 'CargoProfiles',COUNT(*) FROM CargoProfiles
UNION ALL
SELECT 'Devices',      COUNT(*) FROM Devices
UNION ALL
SELECT 'Shipments',    COUNT(*) FROM Shipments
UNION ALL
SELECT 'Ownership',    COUNT(*) FROM Ownership
UNION ALL
SELECT 'AlarmEvents',  COUNT(*) FROM AlarmEvents
UNION ALL
SELECT 'Users',        COUNT(*) FROM Users;

-- Kiểm tra: mỗi shipment đang hoạt động chỉ có đúng 1 ownership active
SELECT ShipmentID, COUNT(*) AS active_count
FROM Ownership
WHERE EndAtUTC IS NULL
GROUP BY ShipmentID
HAVING active_count > 1;
-- Kết quả mong đợi: 0 hàng (không có vi phạm UNIQUE constraint)

-- Kiểm tra shipment ALARM phải có alarm event OPEN
SELECT s.ShipmentID, s.Status, COUNT(a.AlarmEventID) AS open_alarms
FROM Shipments s
LEFT JOIN AlarmEvents a ON a.ShipmentID = s.ShipmentID AND a.Status = 'OPEN'
WHERE s.Status = 'ALARM'
GROUP BY s.ShipmentID, s.Status;
-- Mong đợi: SHP-002 có 1 open alarm

SELECT 'Seed complete!' AS status;
