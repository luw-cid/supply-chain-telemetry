'use strict';

/**
 * ============================================================================
 * Route: Chain of Custody (custody.route.js)
 * ============================================================================
 * Định nghĩa các endpoint cho Nhóm API Chuỗi Sở Hữu.
 * Mount tại: /api/v1/shipments  (trong app.js)
 *
 * Endpoints:
 *   POST /api/v1/shipments/:id/transfer         — 3.1 Transfer Ownership
 *   GET  /api/v1/shipments/:id/ownership-history — 3.2 Ownership History
 *
 * Tất cả routes yêu cầu JWT Bearer Token (middleware authenticate).
 *
 * Tác giả: Senior NodeJS Engineer
 * Tạo: 2026-03-18
 * ============================================================================
 */

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  transferOwnershipController,
  getOwnershipHistoryController,
} = require('../controllers/custody.controller');

const router = express.Router();

/**
 * @route   POST /api/v1/shipments/:id/transfer
 * @desc    3.1 Bàn giao pháp lý quyền sở hữu lô hàng (Change of Custody)
 * @access  Private (JWT required)
 *
 * Middleware: authenticate — xác thực JWT, gắn req.user
 * Controller: transferOwnershipController
 *
 * Body params:
 *   fromPartyId        {string}  required — Bên chuyển giao (phải là chủ sở hữu hiện tại)
 *   toPartyId          {string}  required — Bên nhận
 *   handoverPortCode   {string}  required — Cảng bàn giao
 *   handoverCondition  {string}  optional — GOOD | DAMAGED | PARTIAL (default: GOOD)
 *   handoverNotes      {string}  optional — Ghi chú
 *   handoverSignature  {string}  optional — Hash chữ ký số
 *   witnessPartyId     {string}  optional — Bên chứng kiến
 */
router.post('/:id/transfer', authenticate, transferOwnershipController);

/**
 * @route   GET /api/v1/shipments/:id/ownership-history
 * @desc    3.2 Truy vết chuỗi lịch sử sở hữu (Recursive CTE)
 * @access  Private (JWT required)
 *
 * Middleware: authenticate — xác thực JWT
 * Controller: getOwnershipHistoryController
 *
 * Query params:
 *   detail  {string}  optional — SUMMARY | DETAILED (default: DETAILED)
 */
router.get('/:id/ownership-history', authenticate, getOwnershipHistoryController);

module.exports = router;
