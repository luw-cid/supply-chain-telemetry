-- ============================================================================
-- ADD LOCATION COLUMNS TO AlarmEvents TABLE
-- ============================================================================
-- Purpose: Thêm cột tọa độ để lưu vị trí xảy ra alarm
-- Date: 2026-05-14
-- ============================================================================

USE supply_chain_sql;

-- Thêm cột Latitude (vĩ độ)
ALTER TABLE AlarmEvents 
ADD COLUMN Latitude DECIMAL(10,8) NULL COMMENT 'Vĩ độ nơi xảy ra alarm' 
AFTER AlarmAtUTC;

-- Thêm cột Longitude (kinh độ)
ALTER TABLE AlarmEvents 
ADD COLUMN Longitude DECIMAL(11,8) NULL COMMENT 'Kinh độ nơi xảy ra alarm' 
AFTER Latitude;

-- Thêm index cho geospatial queries
ALTER TABLE AlarmEvents 
ADD INDEX idx_alarm_location (Latitude, Longitude);

-- Thêm cột ResolutionNote để lưu ghi chú khi resolve alarm
ALTER TABLE AlarmEvents 
ADD COLUMN ResolutionNote TEXT NULL COMMENT 'Ghi chú khi resolve alarm' 
AFTER ResolvedAtUTC;

-- Kiểm tra kết quả
DESCRIBE AlarmEvents;

SELECT 'AlarmEvents table updated successfully with location columns' AS Status;
