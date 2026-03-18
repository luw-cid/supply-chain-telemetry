-- ============================================================================
-- RECURSIVE CTE: Chain of Custody Timeline Trace
-- ============================================================================
-- Description: Sử dụng Recursive CTE để truy vết chuỗi sở hữu (Chain of Custody)
--              theo dòng thời gian cho một shipment cụ thể.
--
-- Purpose:
--   - Truy vết lịch sử chuyển giao quyền sở hữu từ xuất phát đến đích
--   - Hiển thị timeline đầy đủ với thông tin từng bên liên quan
--   - Hỗ trợ compliance và audit trail
--   - Cung cấp ngữ cảnh pháp lý cho tranh chấp
--
-- Features:
--   ✓ Recursive tracing của ownership chain
--   ✓ Định dạng timeline rõ ràng
--   ✓ Thông tin chi tiết bên chuyển giao, bên nhận, bên chứng kiến
--   ✓ Thông tin cảng bàn giao với geolocation
--   ✓ Tính toán thời gian sở hữu (duration)
--   ✓ Tính toán số bước chuyển giao
--
-- Database: supply_chain_sql (MySQL)
-- Created: 2026-03-18
-- ============================================================================

USE supply_chain_sql;

DELIMITER $$

-- ============================================================================
-- STORED PROCEDURE: SP_TraceChainOfCustodyRecursive
-- ============================================================================
-- Input Parameters:
--   p_ShipmentID (VARCHAR(32)): ShipmentID cần truy vết
--   p_DetailLevel (ENUM): 'SUMMARY' | 'DETAILED' (default: DETAILED)
--
-- Output:
--   - Complete chain of custody timeline
--   - With party details, port information, and duration calculations
-- ============================================================================

DROP PROCEDURE IF EXISTS SP_TraceChainOfCustodyRecursive$$

CREATE PROCEDURE SP_TraceChainOfCustodyRecursive(
    IN p_ShipmentID VARCHAR(32),
    IN p_DetailLevel VARCHAR(16)
)
READS SQL DATA
BEGIN
    -- ========================================================================
    -- STEP 1: Validate Input
    -- ========================================================================
    IF p_ShipmentID IS NULL OR TRIM(p_ShipmentID) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ShipmentID is required';
    END IF;
    
    -- Default to DETAILED if not specified
    IF p_DetailLevel IS NULL THEN
        SET p_DetailLevel = 'DETAILED';
    END IF;
    
    IF p_DetailLevel NOT IN ('SUMMARY', 'DETAILED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DetailLevel must be SUMMARY or DETAILED';
    END IF;
    
    -- ========================================================================
    -- STEP 2: Check if shipment exists
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM Shipments WHERE ShipmentID = p_ShipmentID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shipment not found';
    END IF;
    
    -- ========================================================================
    -- STEP 3: Main Query with Recursive CTE
    -- ========================================================================
    IF p_DetailLevel = 'SUMMARY' THEN
        -- SUMMARY Mode: Lightweight view of chain of custody
        WITH RECURSIVE cte_chain_of_custody AS (
            -- ================================================================
            -- ANCHOR MEMBER: First ownership record (earliest)
            -- ================================================================
            -- Tìm bản ghi ownership đầu tiên (sở hữu ban đầu)
            SELECT
                ROW_NUMBER() OVER (ORDER BY o.StartAtUTC ASC) AS step_number,
                o.OwnershipID,
                o.ShipmentID,
                o.PartyID AS CurrentOwnerPartyID,
                p_owner.Name AS CurrentOwnerName,
                NULL AS PreviousOwnerPartyID,
                NULL AS PreviousOwnerName,
                o.StartAtUTC,
                o.EndAtUTC,
                CASE
                    WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS OwnershipStatus,
                o.HandoverPortCode,
                port.Name AS HandoverPortName,
                o.HandoverCondition,
                o.HandoverNotes,
                o.WitnessPartyID,
                witness.Name AS WitnessPartyName,
                1 AS chain_depth
            FROM
                Ownership o
            LEFT JOIN
                Parties p_owner ON o.PartyID = p_owner.PartyID
            LEFT JOIN
                Ports port ON o.HandoverPortCode = port.PortCode
            LEFT JOIN
                Parties witness ON o.WitnessPartyID = witness.PartyID
            WHERE
                o.ShipmentID = p_ShipmentID
                AND o.StartAtUTC = (
                    -- Get earliest ownership
                    SELECT MIN(StartAtUTC)
                    FROM Ownership
                    WHERE ShipmentID = p_ShipmentID
                )
            
            UNION ALL
            
            -- ================================================================
            -- RECURSIVE MEMBER: Next ownership records in chronological order
            -- ================================================================
            -- Tìm bản ghi ownership tiếp theo trong chuỗi
            SELECT
                cte.step_number + 1 AS step_number,
                o_next.OwnershipID,
                o_next.ShipmentID,
                p_next_owner.PartyID AS CurrentOwnerPartyID,
                p_next_owner.Name AS CurrentOwnerName,
                cte.CurrentOwnerPartyID AS PreviousOwnerPartyID,
                cte.CurrentOwnerName AS PreviousOwnerName,
                o_next.StartAtUTC,
                o_next.EndAtUTC,
                CASE
                    WHEN o_next.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS OwnershipStatus,
                o_next.HandoverPortCode,
                port_next.Name AS HandoverPortName,
                o_next.HandoverCondition,
                o_next.HandoverNotes,
                o_next.WitnessPartyID,
                witness_next.Name AS WitnessPartyName,
                cte.chain_depth + 1 AS chain_depth
            FROM
                cte_chain_of_custody cte
            INNER JOIN
                Ownership o_next ON cte.ShipmentID = o_next.ShipmentID
                    AND o_next.StartAtUTC > cte.StartAtUTC
                    AND o_next.StartAtUTC = (
                        -- Get next ownership chronologically
                        SELECT MIN(StartAtUTC)
                        FROM Ownership
                        WHERE ShipmentID = cte.ShipmentID
                            AND StartAtUTC > cte.StartAtUTC
                    )
            LEFT JOIN
                Parties p_next_owner ON o_next.PartyID = p_next_owner.PartyID
            LEFT JOIN
                Ports port_next ON o_next.HandoverPortCode = port_next.PortCode
            LEFT JOIN
                Parties witness_next ON o_next.WitnessPartyID = witness_next.PartyID
            WHERE
                cte.chain_depth < 100  -- Prevent infinite recursion
        )
        -- ====================================================================
        -- FINAL SELECT: Summary View
        -- ====================================================================
        SELECT
            p_ShipmentID AS ShipmentID,
            step_number AS TransferStep,
            CurrentOwnerName AS CurrentOwner,
            PreviousOwnerName AS PreviousOwner,
            OwnershipStatus,
            HandoverPortName AS HandoverPort,
            HandoverCondition,
            StartAtUTC,
            EndAtUTC,
            TIMEDIFF(
                COALESCE(EndAtUTC, CURRENT_TIMESTAMP(6)),
                StartAtUTC
            ) AS OwnershipDuration,
            chain_depth,
            (
                SELECT COUNT(*)
                FROM Ownership
                WHERE ShipmentID = p_ShipmentID
                    AND StartAtUTC <= (SELECT MAX(StartAtUTC) FROM cte_chain_of_custody)
            ) AS TotalTransfers
        FROM
            cte_chain_of_custody
        ORDER BY
            step_number ASC;
    
    ELSE -- DETAILED Mode
        -- DETAILED Mode: Complete view with all supporting information
        WITH RECURSIVE cte_chain_of_custody_detailed AS (
            -- ================================================================
            -- ANCHOR MEMBER: First ownership (detailed)
            -- ================================================================
            SELECT
                ROW_NUMBER() OVER (ORDER BY o.StartAtUTC ASC) AS step_number,
                o.OwnershipID,
                o.ShipmentID,
                1 AS chain_depth,
                o.PartyID AS current_owner_party_id,
                p_owner.Name AS current_owner_name,
                p_owner.PartyType AS current_owner_type,
                p_owner.Email AS current_owner_email,
                p_owner.Phone AS current_owner_phone,
                p_owner.Address AS current_owner_address,
                NULL AS previous_owner_party_id,
                NULL AS previous_owner_name,
                NULL AS previous_owner_type,
                o.StartAtUTC AS start_at_utc,
                o.EndAtUTC AS end_at_utc,
                CASE
                    WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS ownership_status,
                o.HandoverPortCode,
                port.Name AS handover_port_name,
                port.Country AS handover_port_country,
                port.Latitude AS handover_port_latitude,
                port.Longitude AS handover_port_longitude,
                port.Timezone AS handover_port_timezone,
                o.HandoverCondition AS handover_condition,
                o.HandoverNotes AS handover_notes,
                o.HandoverSignature AS handover_signature,
                o.WitnessPartyID AS witness_party_id,
                witness.Name AS witness_party_name,
                witness.PartyType AS witness_party_type,
                CAST(o.StartAtUTC AS CHAR(26)) AS transfer_sequence_path
            FROM
                Ownership o
            LEFT JOIN
                Parties p_owner ON o.PartyID = p_owner.PartyID
            LEFT JOIN
                Ports port ON o.HandoverPortCode = port.PortCode
            LEFT JOIN
                Parties witness ON o.WitnessPartyID = witness.PartyID
            WHERE
                o.ShipmentID = p_ShipmentID
                AND o.StartAtUTC = (
                    SELECT MIN(StartAtUTC)
                    FROM Ownership
                    WHERE ShipmentID = p_ShipmentID
                )
            
            UNION ALL
            
            -- ================================================================
            -- RECURSIVE MEMBER: Next ownership (detailed)
            -- ================================================================
            SELECT
                cte.step_number + 1 AS step_number,
                o_next.OwnershipID,
                o_next.ShipmentID,
                cte.chain_depth + 1 AS chain_depth,
                p_next_owner.PartyID AS current_owner_party_id,
                p_next_owner.Name AS current_owner_name,
                p_next_owner.PartyType AS current_owner_type,
                p_next_owner.Email AS current_owner_email,
                p_next_owner.Phone AS current_owner_phone,
                p_next_owner.Address AS current_owner_address,
                cte.current_owner_party_id AS previous_owner_party_id,
                cte.current_owner_name AS previous_owner_name,
                cte.current_owner_type AS previous_owner_type,
                o_next.StartAtUTC AS start_at_utc,
                o_next.EndAtUTC AS end_at_utc,
                CASE
                    WHEN o_next.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS ownership_status,
                o_next.HandoverPortCode,
                port_next.Name AS handover_port_name,
                port_next.Country AS handover_port_country,
                port_next.Latitude AS handover_port_latitude,
                port_next.Longitude AS handover_port_longitude,
                port_next.Timezone AS handover_port_timezone,
                o_next.HandoverCondition AS handover_condition,
                o_next.HandoverNotes AS handover_notes,
                o_next.HandoverSignature AS handover_signature,
                o_next.WitnessPartyID AS witness_party_id,
                witness_next.Name AS witness_party_name,
                witness_next.PartyType AS witness_party_type,
                CONCAT(cte.transfer_sequence_path, ' -> ', CAST(o_next.StartAtUTC AS CHAR(26))) AS transfer_sequence_path
            FROM
                cte_chain_of_custody_detailed cte
            INNER JOIN
                Ownership o_next ON cte.ShipmentID = o_next.ShipmentID
                    AND o_next.StartAtUTC > cte.start_at_utc
                    AND o_next.StartAtUTC = (
                        SELECT MIN(StartAtUTC)
                        FROM Ownership
                        WHERE ShipmentID = cte.ShipmentID
                            AND StartAtUTC > cte.start_at_utc
                    )
            LEFT JOIN
                Parties p_next_owner ON o_next.PartyID = p_next_owner.PartyID
            LEFT JOIN
                Ports port_next ON o_next.HandoverPortCode = port_next.PortCode
            LEFT JOIN
                Parties witness_next ON o_next.WitnessPartyID = witness_next.PartyID
            WHERE
                cte.chain_depth < 100
        )
        -- ====================================================================
        -- FINAL SELECT: Detailed View
        -- ====================================================================
        SELECT
            p_ShipmentID AS shipment_id,
            step_number,
            current_owner_name,
            current_owner_type,
            current_owner_email,
            current_owner_phone,
            current_owner_address,
            previous_owner_name,
            previous_owner_type,
            handover_port_name,
            handover_port_country,
            handover_port_latitude,
            handover_port_longitude,
            handover_port_timezone,
            handover_condition,
            handover_notes,
            handover_signature,
            witness_party_name,
            witness_party_type,
            start_at_utc,
            end_at_utc,
            TIMESTAMPDIFF(
                HOUR,
                start_at_utc,
                COALESCE(end_at_utc, CURRENT_TIMESTAMP(6))
            ) AS ownership_duration_hours,
            ownership_status,
            transfer_sequence_path,
            chain_depth,
            (
                SELECT COUNT(*)
                FROM Ownership
                WHERE ShipmentID = p_ShipmentID
            ) AS total_transfers_in_chain
        FROM
            cte_chain_of_custody_detailed
        ORDER BY
            step_number ASC;
    
    END IF;
    
END$$

DELIMITER ;

-- ============================================================================
-- USAGE EXAMPLES / TEST CASES
-- ============================================================================
/*

-- EXAMPLE 1: Summary view of chain of custody
CALL SP_TraceChainOfCustodyRecursive(
    'SHIP-001',  -- ShipmentID
    'SUMMARY'     -- DetailLevel
);

-- EXAMPLE 2: Detailed view with all information
CALL SP_TraceChainOfCustodyRecursive(
    'SHIP-001',    -- ShipmentID
    'DETAILED'     -- DetailLevel
);

-- EXAMPLE 3: Verify chain of custody for compliance audit
SELECT
    s.ShipmentID,
    s.Status,
    s.OriginPortCode,
    s.DestinationPortCode,
    COUNT(o.OwnershipID) as total_transfers,
    MIN(o.StartAtUTC) as first_transfer_at,
    MAX(COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))) as last_transfer_at
FROM
    Shipments s
LEFT JOIN
    Ownership o ON s.ShipmentID = o.ShipmentID
WHERE
    s.ShipmentID = 'SHIP-001'
GROUP BY
    s.ShipmentID, s.Status, s.OriginPortCode, s.DestinationPortCode;

*/

-- ============================================================================
-- ALTERNATIVE: Direct Recursive CTE Query (without stored procedure)
-- ============================================================================
-- Use this if you prefer direct SQL execution over stored procedure
-- ============================================================================

/*

-- Direct execution of Recursive CTE for chain of custody tracing
WITH RECURSIVE cte_chain_of_custody AS (
    -- ANCHOR: First ownership
    SELECT
        ROW_NUMBER() OVER (ORDER BY o.StartAtUTC ASC) AS step_number,
        o.OwnershipID,
        o.ShipmentID,
        o.PartyID,
        p.Name AS party_name,
        o.StartAtUTC AS start_at_utc,
        o.EndAtUTC AS end_at_utc,
        o.HandoverPortCode,
        port.Name AS port_name,
        o.HandoverCondition AS handover_condition,
        0 AS recursion_depth,
        CAST(o.OwnershipID AS CHAR(255)) AS path
    FROM
        Ownership o
    LEFT JOIN
        Parties p ON o.PartyID = p.PartyID
    LEFT JOIN
        Ports port ON o.HandoverPortCode = port.PortCode
    WHERE
        o.ShipmentID = 'SHIP-001'
        AND o.StartAtUTC = (
            SELECT MIN(StartAtUTC) FROM Ownership WHERE ShipmentID = 'SHIP-001'
        )
    
    UNION ALL
    
    -- RECURSIVE: Next ownership in sequence
    SELECT
        cte.step_number + 1 AS step_number,
        o.OwnershipID,
        o.ShipmentID,
        o.PartyID,
        p.Name AS party_name,
        o.StartAtUTC AS start_at_utc,
        o.EndAtUTC AS end_at_utc,
        o.HandoverPortCode,
        port.Name AS port_name,
        o.HandoverCondition AS handover_condition,
        cte.recursion_depth + 1 AS recursion_depth,
        CONCAT(cte.path, ' -> ', o.OwnershipID) AS path
    FROM
        cte_chain_of_custody cte
    INNER JOIN
        Ownership o ON cte.ShipmentID = o.ShipmentID
            AND o.StartAtUTC > cte.start_at_utc
            AND o.StartAtUTC = (
                SELECT MIN(StartAtUTC)
                FROM Ownership
                WHERE ShipmentID = cte.ShipmentID AND StartAtUTC > cte.start_at_utc
            )
    LEFT JOIN
        Parties p ON o.PartyID = p.PartyID
    LEFT JOIN
        Ports port ON o.HandoverPortCode = port.PortCode
    WHERE
        cte.recursion_depth < 100
)
SELECT
    step_number,
    party_name,
    port_name,
    handover_condition,
    start_at_utc,
    end_at_utc,
    TIMEDIFF(
        COALESCE(end_at_utc, CURRENT_TIMESTAMP(6)),
        start_at_utc
    ) AS ownership_duration,
    path
FROM
    cte_chain_of_custody
ORDER BY
    step_number ASC;

*/
