-- ============================================================================
-- FIX: Tăng độ dài cột AcknowledgedBy và ResolvedBy trong bảng AlarmEvents
-- ============================================================================
-- Lý do: JWT subject (user.sub) có thể là email hoặc UUID dài hơn 32 ký tự
-- Thay đổi: VARCHAR(32) -> VARCHAR(255)
-- ============================================================================

USE supply_chain_sql;

-- Tăng độ dài cột AcknowledgedBy
ALTER TABLE AlarmEvents 
MODIFY COLUMN AcknowledgedBy VARCHAR(255) NULL;

-- Tăng độ dài cột ResolvedBy
ALTER TABLE AlarmEvents 
MODIFY COLUMN ResolvedBy VARCHAR(255) NULL;

-- Kiểm tra kết quả
DESCRIBE AlarmEvents;
