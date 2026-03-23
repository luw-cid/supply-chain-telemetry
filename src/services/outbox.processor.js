'use strict';

// ============================================================================
// OUTBOX PROCESSOR (Background Worker)
// ============================================================================
// Chức năng:
//   Định kỳ quét bảng `outbox_events` để tìm các event PENDING,
//   gửi notification, rồi đánh dấu PROCESSED (hoặc FAILED nếu hết retry).
//
// Cơ chế AT-LEAST-ONCE delivery:
//   - Mark PROCESSING trước khi gửi → tránh 2 worker gửi trùng
//   - Nếu gửi thất bại → tăng retry_count, reset về PENDING
//   - Sau MAX_RETRY lần → mark FAILED (cần xử lý thủ công)
//
// Lifecycle:
//   - start()  : bắt đầu polling loop
//   - stop()   : dừng polling (graceful shutdown)
// ============================================================================

const { sendNotification, MAX_RETRY } = require('./notification.service');
const outboxRepository = require('../repositories/outbox.repository');

// ---- Cấu hình ---------------------------------------------------------------
const POLL_INTERVAL_MS  = 5_000;  // Quét mỗi 5 giây
const BATCH_SIZE        = 10;     // Xử lý tối đa 10 event mỗi lần quét

// ---- State nội bộ -----------------------------------------------------------
let _intervalId   = null;  // ID của setInterval để có thể stop()
let _isProcessing = false; // Tránh chạy 2 batch cùng lúc nếu batch trước chưa xong

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Bắt đầu Outbox Processor.
 * Gọi một lần duy nhất khi server khởi động (trong app.js).
 */
function start() {
    if (_intervalId) {
        console.warn('[OutboxProcessor] Already running, ignoring start() call');
        return;
    }

    console.log(`[OutboxProcessor] ▶ Started. Poll interval: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE}`);

    // Chạy ngay lần đầu sau 2 giây (để DB kịp kết nối)
    setTimeout(() => _poll(), 2_000);

    // Sau đó chạy định kỳ
    _intervalId = setInterval(() => _poll(), POLL_INTERVAL_MS);
}

/**
 * Dừng Outbox Processor (graceful shutdown).
 * Gọi khi server tắt để tránh memory leak.
 */
function stop() {
    if (_intervalId) {
        clearInterval(_intervalId);
        _intervalId = null;
        console.log('[OutboxProcessor] ⏹ Stopped');
    }
}

// ============================================================================
// PRIVATE: CORE POLLING LOGIC
// ============================================================================

/**
 * Một vòng polling: lấy batch event PENDING → xử lý từng event.
 */
async function _poll() {
    // Bỏ qua nếu batch trước vẫn đang chạy
    if (_isProcessing) {
        console.debug('[OutboxProcessor] Skipping poll: previous batch still running');
        return;
    }

    _isProcessing = true;

    try {
        const events = await _fetchPendingEvents();

        if (events.length === 0) {
            // Không có event nào → im lặng (tránh spam log)
            return;
        }

        console.log(`[OutboxProcessor] 📬 Found ${events.length} pending event(s)`);

        // Xử lý tuần tự để tránh overwhelm notification service
        for (const event of events) {
            await _processEvent(event);
        }

    } catch (err) {
        // Lỗi ở tầng DB hoặc infrastructure → log và chờ lần sau
        console.error('[OutboxProcessor] Poll error:', err.message);
    } finally {
        _isProcessing = false;
    }
}

// ============================================================================
// PRIVATE: DATABASE OPERATIONS
// ============================================================================

/**
 * Lấy batch event PENDING từ DB và mark chúng là PROCESSING.
 * Dùng SELECT ... FOR UPDATE + UPDATE trong transaction để tránh race condition
 * nếu sau này có nhiều worker (horizontal scaling).
 *
 * @returns {Promise<Array>} Danh sách event rows (payload đã được parse thành object)
 */
async function _fetchPendingEvents() {
    return outboxRepository.fetchAndMarkPendingEvents(BATCH_SIZE);
}

/**
 * Xử lý một event: gọi sendNotification, rồi cập nhật status.
 *
 * @param {object} event - Row từ outbox_events (payload đã parse)
 */
async function _processEvent(event) {
    const { id, event_type, retry_count } = event;

    try {
        console.log(`[OutboxProcessor] ⚙ Processing event #${id} [${event_type}] (retry: ${retry_count})`);

        // Gọi Notification Service để gửi thông báo thực sự
        await sendNotification(event);

        // Thành công → mark PROCESSED
        await _markProcessed(id);

        console.log(`[OutboxProcessor] ✅ Event #${id} processed successfully`);

    } catch (err) {
        console.error(`[OutboxProcessor] ❌ Event #${id} failed:`, err.message);

        if (retry_count + 1 >= MAX_RETRY) {
            // Hết lượt retry → mark FAILED (cần người xem xét thủ công)
            await _markFailed(id, err.message);
            console.error(`[OutboxProcessor] 💀 Event #${id} marked FAILED after ${MAX_RETRY} retries`);
        } else {
            // Còn lượt retry → reset về PENDING để lần sau thử lại
            await _markRetry(id, retry_count + 1, err.message);
            console.warn(`[OutboxProcessor] 🔄 Event #${id} will retry (attempt ${retry_count + 1}/${MAX_RETRY})`);
        }
    }
}

// ---- Helpers cập nhật status ------------------------------------------------

async function _markProcessed(id) {
    await outboxRepository.markProcessed(id);
}

async function _markFailed(id, errorMsg) {
    await outboxRepository.markFailed(id, errorMsg);
}

async function _markRetry(id, newRetryCount, errorMsg) {
    await outboxRepository.markRetry(id, newRetryCount, errorMsg);
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = { start, stop };
