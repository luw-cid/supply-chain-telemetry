-- ============================================================================
-- STORED PROCEDURE: SP_TraceRouteContext
-- ============================================================================
-- Description: Cung cấp ngữ cảnh nghiệp vụ cho hành trình shipment
-- Author: Senior Database Engineer
-- Created: 2026-03-01
-- ============================================================================
-- Purpose:
--   Lấy thông tin đầy đủ về shipment bao gồm:
--   - Cargo profile (TempMin, TempMax để đối chiếu vi phạm)
--   - Chain of custody (lịch sử chuyển giao ownership)
--   - Route information (origin, destination, current location)
--   - Alarm history
-- ============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS SP_TraceRouteContext$$

CREATE PROCEDURE SP_TraceRouteContext(
    IN p_ShipmentID VARCHAR(32)
)
BEGIN
    -- ========================================================================
    -- RESULT SET 1: Shipment Overview với Cargo Profile
    -- ========================================================================
    -- Mục đích: Cung cấp thông tin tổng quan và ngưỡng nhiệt độ
    -- Sử dụng: Frontend hiển thị header, backend validate violations
    -- 
    -- OPTIMIZATION:
    -- - STRAIGHT_JOIN để force optimal join order
    -- - LEFT JOIN cho optional relationships (ports, parties)
    -- - Covering index trên Shipments(ShipmentID)
    -- - Computed columns để giảm client-side processing
    -- 
    -- COST ANALYSIS:
    -- - Primary key lookup: O(1)
    -- - Foreign key joins: O(1) mỗi join
    -- - Total: O(1) constant time
    -- ========================================================================
    SELECT STRAIGHT_JOIN
        -- ====================================================================
        -- Shipment Basic Info
        -- ====================================================================
        s.ShipmentID,
        s.Status,
        s.WeightKg,
        s.VolumeM3,
        s.TrackingDeviceID,
        
        -- ====================================================================
        -- Cargo Profile - CRITICAL cho Violation Detection
        -- ====================================================================
        s.CargoProfileID,
        cp.CargoType,
        cp.CargoName,
        cp.TempMin,              -- Ngưỡng nhiệt độ tối thiểu
        cp.TempMax,              -- Ngưỡng nhiệt độ tối đa (dùng cho MongoDB)
        cp.HumidityMin,
        cp.HumidityMax,
        cp.MaxTransitHours,
        cp.HandlingInstructions,
        
        -- ====================================================================
        -- Route Information với Geolocation
        -- ====================================================================
        s.OriginPortCode,
        origin.Name AS OriginPortName,
        origin.Country AS OriginCountry,
        origin.Latitude AS OriginLatitude,
        origin.Longitude AS OriginLongitude,
        origin.Timezone AS OriginTimezone,
        
        s.DestinationPortCode,
        dest.Name AS DestinationPortName,
        dest.Country AS DestinationCountry,
        dest.Latitude AS DestinationLatitude,
        dest.Longitude AS DestinationLongitude,
        dest.Timezone AS DestinationTimezone,
        
        s.CurrentPortCode,
        current_port.Name AS CurrentPortName,
        current_port.Country AS CurrentCountry,
        
        -- ====================================================================
        -- Parties Information
        -- ====================================================================
        s.ShipperPartyID,
        shipper.Name AS ShipperName,
        shipper.Email AS ShipperEmail,
        shipper.Phone AS ShipperPhone,
        shipper.PartyType AS ShipperType,
        
        s.ConsigneePartyID,
        consignee.Name AS ConsigneeName,
        consignee.Email AS ConsigneeEmail,
        consignee.Phone AS ConsigneePhone,
        consignee.PartyType AS ConsigneeType,
        
        -- ====================================================================
        -- Telemetry Status
        -- ====================================================================
        s.LastTelemetryAtUTC,
        s.LastTelemetryStatus,
        s.LastCheckInAtUTC,
        
        -- ====================================================================
        -- Alarm Information
        -- ====================================================================
        s.AlarmAtUTC,
        s.AlarmReason,
        
        -- ====================================================================
        -- Timestamps
        -- ====================================================================
        s.CreatedAtUTC,
        s.UpdatedAtUTC,
        
        -- ====================================================================
        -- Computed Fields - Business Logic
        -- ====================================================================
        
        -- Transit duration (hours)
        TIMESTAMPDIFF(
            HOUR, 
            s.CreatedAtUTC, 
            COALESCE(s.UpdatedAtUTC, CURRENT_TIMESTAMP(6))
        ) AS TotalTransitHours,
        
        -- Transit duration (days) - for display
        ROUND(
            TIMESTAMPDIFF(
                HOUR, 
                s.CreatedAtUTC, 
                COALESCE(s.UpdatedAtUTC, CURRENT_TIMESTAMP(6))
            ) / 24.0, 
            1
        ) AS TotalTransitDays,
        
        -- Remaining transit time (hours)
        CASE 
            WHEN cp.MaxTransitHours IS NOT NULL THEN
                cp.MaxTransitHours - TIMESTAMPDIFF(
                    HOUR, 
                    s.CreatedAtUTC, 
                    CURRENT_TIMESTAMP(6)
                )
            ELSE NULL
        END AS RemainingTransitHours,
        
        -- Transit compliance status
        CASE 
            WHEN cp.MaxTransitHours IS NULL THEN 'NO_LIMIT'
            WHEN TIMESTAMPDIFF(HOUR, s.CreatedAtUTC, CURRENT_TIMESTAMP(6)) > cp.MaxTransitHours 
            THEN 'EXCEEDED'
            WHEN TIMESTAMPDIFF(HOUR, s.CreatedAtUTC, CURRENT_TIMESTAMP(6)) > cp.MaxTransitHours * 0.9 
            THEN 'WARNING'
            ELSE 'OK'
        END AS TransitComplianceStatus,
        
        -- Telemetry data freshness
        CASE 
            WHEN s.LastTelemetryAtUTC IS NULL THEN 'NO_DATA'
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 24 THEN 'STALE'
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 6 THEN 'AGING'
            ELSE 'FRESH'
        END AS TelemetryDataFreshness,
        
        -- Hours since last telemetry
        TIMESTAMPDIFF(
            HOUR, 
            s.LastTelemetryAtUTC, 
            CURRENT_TIMESTAMP(6)
        ) AS HoursSinceLastTelemetry,
        
        -- Overall health score (0-100)
        CASE 
            WHEN s.Status = 'ALARM' THEN 0
            WHEN s.LastTelemetryStatus = 'VIOLATION' THEN 30
            WHEN s.LastTelemetryStatus = 'UNKNOWN' THEN 50
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 24 THEN 40
            WHEN s.LastTelemetryStatus = 'OK' THEN 100
            ELSE 70
        END AS HealthScore
        
    FROM Shipments s
    
    -- INNER JOIN: Cargo profile is mandatory
    INNER JOIN CargoProfiles cp 
        ON s.CargoProfileID = cp.CargoProfileID
    
    -- LEFT JOINs: Optional relationships
    LEFT JOIN Ports origin 
        ON s.OriginPortCode = origin.PortCode
    LEFT JOIN Ports dest 
        ON s.DestinationPortCode = dest.PortCode
    LEFT JOIN Ports current_port 
        ON s.CurrentPortCode = current_port.PortCode
    LEFT JOIN Parties shipper 
        ON s.ShipperPartyID = shipper.PartyID
    LEFT JOIN Parties consignee 
        ON s.ConsigneePartyID = consignee.PartyID
    
    WHERE s.ShipmentID = p_ShipmentID;
    
    
    -- ========================================================================
    -- RESULT SET 2: Chain of Custody (Audit Trail)
    -- ========================================================================
    -- Mục đích: Xác định các chặng chịu trách nhiệm pháp lý
    -- Sử dụng: Compliance, dispute resolution, liability tracking
    -- 
    -- OPTIMIZATION:
    -- - USE INDEX hint để force idx_ownership_shipment_end
    -- - Window function ROW_NUMBER() cho sequence
    -- - LEFT JOINs cho optional witness
    -- - ORDER BY với indexed column
    -- 
    -- COST ANALYSIS:
    -- - Index range scan: O(log n + k) với k = số ownership records
    -- - JOINs: O(k) với k ownership records
    -- - Window function: O(k log k)
    -- - Total: O(k log k) - acceptable cho k < 100
    -- ========================================================================
    SELECT 
        -- ====================================================================
        -- Ownership Identity
        -- ====================================================================
        o.OwnershipID,
        o.ShipmentID,
        
        -- ====================================================================
        -- Party Information
        -- ====================================================================
        o.PartyID,
        p.Name AS PartyName,
        p.PartyType,
        p.Email AS PartyEmail,
        p.Phone AS PartyPhone,
        p.Status AS PartyStatus,
        
        -- ====================================================================
        -- Ownership Timeline
        -- ====================================================================
        o.StartAtUTC,
        o.EndAtUTC,
        
        -- Status classification
        CASE 
            WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
            ELSE 'COMPLETED'
        END AS OwnershipStatus,
        
        -- ====================================================================
        -- Duration Calculations
        -- ====================================================================
        
        -- Duration in hours
        TIMESTAMPDIFF(
            HOUR, 
            o.StartAtUTC, 
            COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
        ) AS DurationHours,
        
        -- Duration in days (rounded)
        ROUND(
            TIMESTAMPDIFF(
                HOUR, 
                o.StartAtUTC, 
                COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
            ) / 24.0,
            1
        ) AS DurationDays,
        
        -- Duration in minutes (for short transits)
        TIMESTAMPDIFF(
            MINUTE, 
            o.StartAtUTC, 
            COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
        ) AS DurationMinutes,
        
        -- ====================================================================
        -- Handover Details
        -- ====================================================================
        o.HandoverPortCode,
        port.Name AS HandoverPortName,
        port.Country AS HandoverCountry,
        port.Latitude AS HandoverLatitude,
        port.Longitude AS HandoverLongitude,
        
        o.HandoverCondition,
        o.HandoverNotes,
        
        -- ====================================================================
        -- Witness Information (Optional)
        -- ====================================================================
        o.WitnessPartyID,
        witness.Name AS WitnessName,
        witness.PartyType AS WitnessType,
        witness.Email AS WitnessEmail,
        
        -- ====================================================================
        -- Digital Signature & Verification
        -- ====================================================================
        o.HandoverSignature,
        
        -- Signature verification status
        CASE 
            WHEN o.HandoverSignature IS NOT NULL THEN 'SIGNED'
            WHEN o.EndAtUTC IS NOT NULL THEN 'UNSIGNED'
            ELSE 'PENDING'
        END AS SignatureStatus,
        
        -- ====================================================================
        -- Sequence & Ordering
        -- ====================================================================
        
        -- Sequence number (1st owner, 2nd owner, etc.)
        ROW_NUMBER() OVER (ORDER BY o.StartAtUTC) AS OwnershipSequence,
        
        -- Total number of transfers
        COUNT(*) OVER () AS TotalTransfers,
        
        -- Is this the current owner?
        CASE 
            WHEN o.EndAtUTC IS NULL THEN 1
            ELSE 0
        END AS IsCurrentOwner,
        
        -- ====================================================================
        -- Risk Indicators
        -- ====================================================================
        
        -- Handover risk score
        CASE 
            WHEN o.HandoverCondition = 'DAMAGED' THEN 'HIGH'
            WHEN o.HandoverCondition = 'PARTIAL' THEN 'MEDIUM'
            WHEN o.HandoverSignature IS NULL AND o.EndAtUTC IS NOT NULL THEN 'MEDIUM'
            ELSE 'LOW'
        END AS HandoverRiskLevel,
        
        -- Compliance flags
        CASE 
            WHEN o.HandoverSignature IS NULL AND o.EndAtUTC IS NOT NULL THEN 1
            ELSE 0
        END AS MissingSignatureFlag,
        
        CASE 
            WHEN o.HandoverCondition != 'GOOD' THEN 1
            ELSE 0
        END AS DamageFlag
        
    FROM Ownership o USE INDEX (idx_ownership_shipment_end)
    
    -- INNER JOIN: Party is mandatory
    INNER JOIN Parties p 
        ON o.PartyID = p.PartyID
    
    -- LEFT JOINs: Optional relationships
    LEFT JOIN Ports port 
        ON o.HandoverPortCode = port.PortCode
    LEFT JOIN Parties witness 
        ON o.WitnessPartyID = witness.PartyID
    
    WHERE o.ShipmentID = p_ShipmentID
    
    -- Chronological order (oldest first)
    ORDER BY o.StartAtUTC ASC;
    
    
    -- ========================================================================
    -- RESULT SET 3: Alarm History
    -- ========================================================================
    -- Mục đích: Hiển thị tất cả incidents trong hành trình
    -- Sử dụng: Risk assessment, quality control, SLA monitoring
    -- ========================================================================
    -- Tối ưu: Sử dụng index idx_alarm_shipment_at
    -- ========================================================================
    SELECT 
        a.AlarmEventID,
        a.ShipmentID,
        
        -- Alarm classification
        a.AlarmType,
        a.Severity,
        a.Status,
        a.AlarmReason,
        a.Source,
        
        -- Timeline
        a.AlarmAtUTC,
        a.AcknowledgedAtUTC,
        a.ResolvedAtUTC,
        
        -- Response time metrics
        CASE 
            WHEN a.AcknowledgedAtUTC IS NOT NULL THEN
                TIMESTAMPDIFF(MINUTE, a.AlarmAtUTC, a.AcknowledgedAtUTC)
            ELSE NULL
        END AS AcknowledgeTimeMinutes,
        
        CASE 
            WHEN a.ResolvedAtUTC IS NOT NULL THEN
                TIMESTAMPDIFF(HOUR, a.AlarmAtUTC, a.ResolvedAtUTC)
            ELSE NULL
        END AS ResolutionTimeHours,
        
        -- Responsible parties
        a.AcknowledgedBy,
        a.ResolvedBy,
        
        -- Timestamps
        a.CreatedAtUTC,
        
        -- Status indicators
        CASE 
            WHEN a.Status = 'OPEN' AND TIMESTAMPDIFF(HOUR, a.AlarmAtUTC, CURRENT_TIMESTAMP(6)) > 24 
            THEN 'OVERDUE'
            WHEN a.Status = 'OPEN' 
            THEN 'PENDING'
            ELSE a.Status
        END AS AlarmStatusDetail
        
    FROM AlarmEvents a
    WHERE a.ShipmentID = p_ShipmentID
    ORDER BY a.AlarmAtUTC DESC;  -- Most recent first
    
    
    -- ========================================================================
    -- RESULT SET 4: Route Statistics Summary
    -- ========================================================================
    -- Mục đích: Tổng hợp metrics cho dashboard
    -- Sử dụng: Executive summary, KPI tracking
    -- ========================================================================
    SELECT 
        p_ShipmentID AS ShipmentID,
        
        -- Ownership metrics
        (SELECT COUNT(*) 
         FROM Ownership 
         WHERE ShipmentID = p_ShipmentID) AS TotalOwnershipTransfers,
        
        (SELECT COUNT(*) 
         FROM Ownership 
         WHERE ShipmentID = p_ShipmentID 
         AND HandoverCondition != 'GOOD') AS DamagedHandovers,
        
        -- Alarm metrics
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID) AS TotalAlarms,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND AlarmType = 'TEMP_VIOLATION') AS TempViolations,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Status = 'OPEN') AS OpenAlarms,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Severity = 'CRITICAL') AS CriticalAlarms,
        
        -- Average resolution time
        (SELECT AVG(TIMESTAMPDIFF(HOUR, AlarmAtUTC, ResolvedAtUTC))
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Status = 'RESOLVED') AS AvgResolutionTimeHours,
        
        -- Current status
        (SELECT Status FROM Shipments WHERE ShipmentID = p_ShipmentID) AS CurrentStatus,
        
        (SELECT LastTelemetryStatus FROM Shipments WHERE ShipmentID = p_ShipmentID) AS LastTelemetryStatus;
        
END$$

DELIMITER ;

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================
-- CALL SP_TraceRouteContext('SHP-2024-001234');
-- 
-- Returns 4 result sets:
-- 1. Shipment overview with cargo profile and temperature thresholds
-- 2. Complete chain of custody ordered by time
-- 3. All alarm events with response metrics
-- 4. Summary statistics
-- ============================================================================

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- Indexes used:
-- - PRIMARY KEY on Shipments(ShipmentID)
-- - idx_ownership_shipment_end on Ownership(ShipmentID, EndAtUTC)
-- - idx_alarm_shipment_at on AlarmEvents(ShipmentID, AlarmAtUTC)
-- - Foreign key indexes on Parties, Ports, CargoProfiles
--
-- Expected execution time: < 50ms for typical shipment
-- Scalability: O(n) where n = number of ownership transfers + alarms
-- ============================================================================
