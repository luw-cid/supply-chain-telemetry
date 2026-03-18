'use strict';

/**
 * ============================================================================
 * Controller: Chain of Custody (custody.controller.js)
 * ============================================================================
 * Tầng HTTP cho Nhóm API Chuỗi Sở Hữu. Chỉ xử lý:
 *   - Đọc request (params, body, query)
 *   - Gọi service
 *   - Trả response JSON
 *
 * Tác giả: Senior NodeJS Engineer
 * Tạo: 2026-03-18
 * ============================================================================
 */

const {
  transferOwnership,
  getOwnershipHistory,
} = require('../services/custody.service');

// ============================================================================
// 3.1  POST /api/v1/shipments/:id/transfer
// ============================================================================
/**
 * Thực hiện bàn giao pháp lý quyền sở hữu lô hàng.
 *
 * Request:
 *   Param  → :id              (shipmentId)
 *   Header → Authorization: Bearer <JWT>
 *   Body   → { fromPartyId, toPartyId, handoverPortCode,
 *               handoverCondition?, handoverNotes?,
 *               handoverSignature?, witnessPartyId? }
 *
 * Response 200 OK:
 *   { success: true, message: string, data: { shipmentId, fromPartyId,
 *     toPartyId, handoverPortCode, handoverCondition, transferredAtUTC } }
 *
 * Error responses: 400 | 401 | 403 | 404 | 409 | 500
 */
async function transferOwnershipController(req, res) {
  try {
    const shipmentId = req.params.id;
    const result = await transferOwnership(shipmentId, req.body);

    return res.status(200).json({
      success: true,
      message: result.message || 'Custody transfer completed successfully',
      data: {
        shipmentId: result.shipmentId,
        fromPartyId: result.fromPartyId,
        toPartyId: result.toPartyId,
        handoverPortCode: result.handoverPortCode,
        handoverCondition: result.handoverCondition,
        transferredAtUTC: result.transferredAtUTC,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

// ============================================================================
// 3.2  GET /api/v1/shipments/:id/ownership-history
// ============================================================================
/**
 * Truy vết chuỗi lịch sử sở hữu của lô hàng bằng Recursive CTE.
 *
 * Request:
 *   Param → :id                       (shipmentId)
 *   Query → ?detail=DETAILED|SUMMARY  (default: DETAILED)
 *   Header → Authorization: Bearer <JWT>
 *
 * Response 200 OK:
 *   { success: true, data: { shipmentId, detailLevel,
 *     totalTransfers, chain: [...] } }
 *
 * Error responses: 400 | 401 | 404 | 500
 */
async function getOwnershipHistoryController(req, res) {
  try {
    const shipmentId = req.params.id;
    const detailLevel = req.query.detail || 'DETAILED';

    const result = await getOwnershipHistory(shipmentId, detailLevel);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

module.exports = {
  transferOwnershipController,
  getOwnershipHistoryController,
};
