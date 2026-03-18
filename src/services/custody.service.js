'use strict';

/**
 * ============================================================================
 * Service: Chain of Custody (custody.service.js)
 * ============================================================================
 * Lớp business logic cho Nhóm API Chuỗi Sở Hữu.
 *
 * Dữ liệu chính: MySQL
 *   - sp_change_custody             — thực thi bàn giao nguyên tử
 *   - SP_TraceChainOfCustodyRecursive — recursive CTE truy vết lịch sử
 *
 * Tác giả: Senior NodeJS Engineer
 * Tạo: 2026-03-18
 * ============================================================================
 */

const { pool } = require('../configs/sql.config');
const AppError = require('../utils/app-error');

// ── Helpers lỗi nhất quán theo pattern của codebase ──────────────────────────

/** Tạo lỗi HTTP 400 Bad Request */
function badRequest(message) {
  return AppError.badRequest(message);
}

/** Tạo lỗi HTTP 403 Forbidden */
function forbidden(message) {
  return AppError.forbidden(message);
}

/** Tạo lỗi HTTP 404 Not Found */
function notFound(message) {
  return AppError.notFound(message);
}

/** Tạo lỗi HTTP 409 Conflict */
function conflict(message) {
  return AppError.conflict(message);
}

// ── Map thông báo lỗi từ Stored Procedure sang HTTP status tương ứng ─────────
/**
 * Chuyển đổi thông báo lỗi text từ SP sang đối tượng Error với HTTP status
 * đúng ngữ nghĩa REST.
 *
 * @param {string} spMessage - Nội dung trường p_message trả về từ SP
 * @returns {Error}
 */
function mapSpMessageToError(spMessage) {
  const msg = spMessage || 'Unknown error from stored procedure';

  if (msg.includes('not found') || msg.includes('No active ownership')) {
    return notFound(msg);
  }
  if (msg.includes('ALARM')) {
    return conflict(msg);
  }
  if (msg.includes('not the current owner') || msg.includes('not authorized')) {
    return forbidden(msg);
  }
  // Tất cả lỗi validation còn lại → 400
  return badRequest(msg);
}

// ============================================================================
// 3.1  transferOwnership
// ============================================================================
/**
 * Thực hiện bàn giao pháp lý quyền sở hữu lô hàng giữa các bên.
 *
 * Luồng xử lý:
 *  1. Validate input cơ bản tại tầng Node trước khi chạm DB
 *  2. Gọi sp_change_custody với OUT params qua CALL + SELECT @var
 *  3. Đọc kết quả @p_success / @p_message từ session variables
 *  4. Map lỗi SP → HTTP Error hoặc trả về kết quả thành công
 *
 * Tại sao dùng session variables thay vì OUT params trực tiếp?
 *   mysql2/promise không hỗ trợ đọc OUT params sau CALL trong một query đơn.
 *   Dùng lệnh SET @var trước rồi SELECT @var sau là pattern chuẩn cho mysql2.
 *
 * @param {string} shipmentId       - ID lô hàng (từ URL param)
 * @param {object} body             - Body request
 * @param {string} body.fromPartyId - Bên chuyển giao (phải là chủ sở hữu hiện tại)
 * @param {string} body.toPartyId   - Bên nhận quyền sở hữu
 * @param {string} body.handoverPortCode    - Cảng bàn giao
 * @param {string} [body.handoverCondition] - GOOD | DAMAGED | PARTIAL (default: GOOD)
 * @param {string} [body.handoverNotes]     - Ghi chú tự do
 * @param {string} [body.handoverSignature] - Hash chữ ký số
 * @param {string} [body.witnessPartyId]    - Bên chứng kiến (optional)
 * @returns {Promise<{shipmentId, fromPartyId, toPartyId, handoverPortCode, handoverCondition, transferredAtUTC}>}
 * @throws {Error} badRequest | forbidden | notFound | conflict
 */
async function transferOwnership(shipmentId, body) {
  // ── 1. Validate input tại tầng service ──────────────────────────────────
  if (!shipmentId || String(shipmentId).trim() === '') {
    throw badRequest('shipmentId is required');
  }

  const {
    fromPartyId,
    toPartyId,
    handoverPortCode,
    handoverCondition = 'GOOD',
    handoverNotes = null,
    handoverSignature = null,
    witnessPartyId = null,
  } = body || {};

  if (!fromPartyId || String(fromPartyId).trim() === '') {
    throw badRequest('fromPartyId is required');
  }
  if (!toPartyId || String(toPartyId).trim() === '') {
    throw badRequest('toPartyId is required');
  }
  if (!handoverPortCode || String(handoverPortCode).trim() === '') {
    throw badRequest('handoverPortCode is required');
  }
  if (!['GOOD', 'DAMAGED', 'PARTIAL'].includes(handoverCondition)) {
    throw badRequest('handoverCondition must be GOOD, DAMAGED, or PARTIAL');
  }
  if (fromPartyId === toPartyId) {
    throw badRequest('fromPartyId and toPartyId must be different parties');
  }

  // ── 2. Gọi Stored Procedure qua CALL + lấy OUT params bằng session vars ──
  //   Bước SET @p_success, @p_message trước đảm bảo giá trị luôn được khởi
  //   tạo dù SP có chạy hay không (tránh đọc NULL từ phiên cũ).
  await pool.query('SET @p_success = 0, @p_message = NULL');

  await pool.query(
    `CALL sp_change_custody(
      ?, ?, ?, ?, ?, ?, ?, ?,
      @p_success, @p_message
    )`,
    [
      String(shipmentId).trim(),
      String(fromPartyId).trim(),
      String(toPartyId).trim(),
      String(handoverPortCode).trim(),
      handoverCondition,
      handoverNotes,
      handoverSignature,
      witnessPartyId,
    ]
  );

  // ── 3. Đọc kết quả OUT params ────────────────────────────────────────────
  const [[outRow]] = await pool.query(
    'SELECT @p_success AS success, @p_message AS message'
  );

  const spSuccess = Number(outRow.success) === 1;
  const spMessage = outRow.message;

  // ── 4. Xử lý kết quả ────────────────────────────────────────────────────
  if (!spSuccess) {
    throw mapSpMessageToError(spMessage);
  }

  return {
    shipmentId: String(shipmentId).trim(),
    fromPartyId: String(fromPartyId).trim(),
    toPartyId: String(toPartyId).trim(),
    handoverPortCode: String(handoverPortCode).trim(),
    handoverCondition,
    transferredAtUTC: new Date().toISOString(),
    message: spMessage,
  };
}

// ============================================================================
// 3.2  getOwnershipHistory
// ============================================================================
/**
 * Truy vết toàn bộ chuỗi sở hữu của một lô hàng dưới dạng timeline
 * sử dụng Recursive CTE trong Stored Procedure MySQL.
 *
 * Tại sao Recursive CTE?
 *   Chuỗi sở hữu là cấu trúc có tính liên tiếp (mỗi bản ghi sở hữu trỏ
 *   đến bản ghi tiếp theo theo thời gian). Recursive CTE cho phép MySQL
 *   tự động "leo" qua từng nút trong chuỗi mà không cần N truy vấn riêng lẻ,
 *   đảm bảo chuỗi không chồng chéo và đầy đủ.
 *
 * @param {string} shipmentId   - ID lô hàng
 * @param {string} [detailLevel='DETAILED'] - 'SUMMARY' | 'DETAILED'
 * @returns {Promise<{shipmentId, detailLevel, totalTransfers, chain: object[]}>}
 * @throws {Error} notFound | badRequest
 */
async function getOwnershipHistory(shipmentId, detailLevel = 'DETAILED') {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  if (!shipmentId || String(shipmentId).trim() === '') {
    throw badRequest('shipmentId is required');
  }

  const level = String(detailLevel || 'DETAILED').toUpperCase();
  if (!['SUMMARY', 'DETAILED'].includes(level)) {
    throw badRequest('detailLevel must be SUMMARY or DETAILED');
  }

  // ── 2. Gọi Stored Procedure ──────────────────────────────────────────────
  //   SP dùng SIGNAL để throw lỗi SQL nếu shipment không tồn tại → mysql2
  //   sẽ reject promise với error.message chứa nội dung SIGNAL.
  let rows;
  try {
    const [result] = await pool.query(
      'CALL SP_TraceChainOfCustodyRecursive(?, ?)',
      [String(shipmentId).trim(), level]
    );
    // mysql2 trả về mảng result sets khi CALL SP có SELECT,
    // result[0] là rows của SELECT đầu tiên bên trong SP
    rows = Array.isArray(result) ? result : [];
  } catch (spError) {
    // SP dùng SIGNAL SQLSTATE '45000' khi shipment không tồn tại
    const msg = spError.message || '';
    if (msg.includes('not found') || msg.includes('required')) {
      throw notFound(msg);
    }
    throw spError;
  }

  // ── 3. Xây dựng response ─────────────────────────────────────────────────
  // Chuẩn hoá tên field về camelCase trước khi trả về client
  const chain = rows.map((row) => {
    if (level === 'SUMMARY') {
      return {
        transferStep: row.TransferStep,
        currentOwner: row.CurrentOwner,
        previousOwner: row.PreviousOwner,
        ownershipStatus: row.OwnershipStatus,
        handoverPort: row.HandoverPort,
        handoverCondition: row.HandoverCondition,
        startAtUTC: row.StartAtUTC,
        endAtUTC: row.EndAtUTC,
        ownershipDuration: row.OwnershipDuration,
        chainDepth: row.chain_depth,
      };
    }
    // DETAILED
    return {
      stepNumber: row.step_number,
      currentOwner: {
        name: row.current_owner_name,
        type: row.current_owner_type,
        email: row.current_owner_email,
        phone: row.current_owner_phone,
        address: row.current_owner_address,
      },
      previousOwner: row.previous_owner_name
        ? {
            name: row.previous_owner_name,
            type: row.previous_owner_type,
          }
        : null,
      handoverPort: {
        code: row.HandoverPortCode,
        name: row.handover_port_name,
        country: row.handover_port_country,
        latitude: row.handover_port_latitude,
        longitude: row.handover_port_longitude,
        timezone: row.handover_port_timezone,
      },
      handoverCondition: row.handover_condition,
      handoverNotes: row.handover_notes,
      handoverSignature: row.handover_signature,
      witness: row.witness_party_name
        ? {
            name: row.witness_party_name,
            type: row.witness_party_type,
          }
        : null,
      startAtUTC: row.start_at_utc,
      endAtUTC: row.end_at_utc,
      ownershipDurationHours: row.ownership_duration_hours,
      ownershipStatus: row.ownership_status,
      transferSequencePath: row.transfer_sequence_path,
      chainDepth: row.chain_depth,
    };
  });

  return {
    shipmentId: String(shipmentId).trim(),
    detailLevel: level,
    totalTransfers: chain.length > 0 ? rows[0].total_transfers_in_chain ?? chain.length : 0,
    chain,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  transferOwnership,
  getOwnershipHistory,
};
