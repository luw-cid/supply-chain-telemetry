-- ============================================================================
-- Extra seed ports for testing (INSERT IGNORE — safe to re-run)
-- Run after schema (mysql.sql). Optional: merge into main ports seed.
-- mysql -u root -p YOUR_DB < src/seed-data/ports_extra.sql
-- ============================================================================

INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status) VALUES
('THBKK', 'Laem Chabang Port', 'Thailand', 13.09390000, 100.92000000, 'Asia/Bangkok', 'OPERATIONAL'),
('IDJKT', 'Tanjung Priok (Jakarta)', 'Indonesia', -6.10780000, 106.88340000, 'Asia/Jakarta', 'OPERATIONAL'),
('MYPNG', 'Port of Penang', 'Malaysia', 5.41640000, 100.33270000, 'Asia/Kuala_Lumpur', 'OPERATIONAL'),
('INMUN', 'Jawaharlal Nehru Port (Nhava Sheva)', 'India', 18.94900000, 72.95200000, 'Asia/Kolkata', 'OPERATIONAL'),
('LKAHL', 'Port of Colombo', 'Sri Lanka', 6.93970000, 79.83820000, 'Asia/Colombo', 'OPERATIONAL'),
('PHMNL', 'Port of Manila', 'Philippines', 14.62080000, 120.94370000, 'Asia/Manila', 'OPERATIONAL'),
('TWKEZ', 'Port of Kaohsiung', 'Taiwan', 22.56670000, 120.30140000, 'Asia/Taipei', 'OPERATIONAL'),
('VNDAD', 'Da Nang Port', 'Vietnam', 16.09800000, 108.23400000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
('VNCMY', 'Cam Ranh / Nha Trang area', 'Vietnam', 12.23880000, 109.19670000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL');
