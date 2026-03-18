'use strict';

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================
// Chức năng: Gửi thông báo cảnh báo ra bên ngoài hệ thống.
//
// Hiện tại triển khai theo kiểu SIMULATION (log ra console) vì project
// chưa cấu hình SMTP server thực. Kiến trúc đã chuẩn bị để dễ dàng
// mở rộng sang nodemailer, Twilio SMS, Slack webhook, v.v.
//
// Cách mở rộng:
//   1. Cài: npm install nodemailer
//   2. Uncomment phần _sendEmail thực
//   3. Thêm SMTP_HOST, SMTP_USER, SMTP_PASS vào .env
// ============================================================================

const { pool } = require('../configs/sql.config');

// ---- Cấu hình ----------------------------------------------------------------
const MAX_RETRY = 3; // Số lần retry tối đa trước khi mark FAILED

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Gửi thông báo cho một alarm event.
 * Được gọi bởi OutboxProcessor sau khi đọc bảng outbox_events.
 *
 * @param {object} event  - Row từ bảng outbox_events
 *   event.id         {number}  - ID của outbox event
 *   event.event_type {string}  - Loại event (ALARM_TRIGGERED, v.v.)
 *   event.payload    {object}  - Dữ liệu event đã parse thành object
 */
async function sendNotification(event) {
    const { event_type, payload } = event;

    switch (event_type) {
        case 'ALARM_TRIGGERED':
            await _handleAlarmTriggered(payload);
            break;

        case 'VIOLATION_DETECTED':
            await _handleViolationDetected(payload);
            break;

        case 'CUSTODY_BLOCKED':
            await _handleCustodyBlocked(payload);
            break;

        default:
            // Không crash với event type không biết, chỉ log warning
            console.warn(`[NotificationService] Unknown event_type: "${event_type}" - skipping`);
    }
}

// ============================================================================
// PRIVATE HANDLERS (mỗi loại event có handler riêng)
// ============================================================================

/**
 * Xử lý khi Shipment bị ALARM.
 * Gửi thông báo đến ShipperPartyID và ConsigneePartyID.
 */
async function _handleAlarmTriggered(payload) {
    const {
        shipment_id,
        shipper_email,
        consignee_email,
        shipper_name,
        consignee_name,
        alarm_reason,
        alarm_at,
        temp,
        temp_max,
        location,
    } = payload;

    const subject = `🚨 [ALARM] Lô hàng ${shipment_id} đã kích hoạt cảnh báo`;

    const body = _buildAlarmEmailBody({
        shipment_id,
        alarm_reason,
        alarm_at,
        temp,
        temp_max,
        location,
    });

    // Gửi đến cả shipper và consignee
    const recipients = [];
    if (shipper_email)   recipients.push({ email: shipper_email,   name: shipper_name   || 'Shipper' });
    if (consignee_email) recipients.push({ email: consignee_email, name: consignee_name || 'Consignee' });

    if (recipients.length === 0) {
        console.warn(`[NotificationService] ALARM_TRIGGERED: No email recipient found for shipment ${shipment_id}`);
        return;
    }

    for (const recipient of recipients) {
        await _sendEmail(recipient.email, recipient.name, subject, body);
    }
}

/**
 * Xử lý khi phát hiện vi phạm nhiệt độ (trước khi ALARM chính thức).
 */
async function _handleViolationDetected(payload) {
    const { shipment_id, shipper_email, shipper_name, temp, temp_max } = payload;

    const subject = `⚠️ [CẢNH BÁO] Nhiệt độ bất thường - Lô hàng ${shipment_id}`;

    const body = [
        `Kính gửi ${shipper_name || 'Quý khách'},`,
        ``,
        `Hệ thống phát hiện nhiệt độ bất thường cho lô hàng ${shipment_id}:`,
        `  • Nhiệt độ hiện tại : ${temp}°C`,
        `  • Giới hạn cho phép : ${temp_max}°C`,
        `  • Mức vượt ngưỡng   : +${(temp - temp_max).toFixed(2)}°C`,
        ``,
        `Vui lòng kiểm tra ngay thiết bị vận chuyển.`,
        ``,
        `Trân trọng,`,
        `Supply Chain Monitoring System`,
    ].join('\n');

    if (shipper_email) {
        await _sendEmail(shipper_email, shipper_name, subject, body);
    }
}

/**
 * Xử lý khi bàn giao quyền sở hữu bị chặn do Shipment đang ALARM.
 */
async function _handleCustodyBlocked(payload) {
    const { shipment_id, blocked_party_email, blocked_party_name, reason } = payload;

    const subject = `🔒 [CHẶN] Bàn giao lô hàng ${shipment_id} bị từ chối`;

    const body = [
        `Kính gửi ${blocked_party_name || 'Quý đối tác'},`,
        ``,
        `Yêu cầu bàn giao quyền sở hữu lô hàng ${shipment_id} đã bị TỪ CHỐI.`,
        ``,
        `Lý do: ${reason || 'Lô hàng đang ở trạng thái ALARM'}`,
        ``,
        `Bàn giao chỉ được thực hiện khi trạng thái cảnh báo được giải quyết.`,
        `Vui lòng liên hệ bộ phận quản lý để biết thêm chi tiết.`,
        ``,
        `Trân trọng,`,
        `Supply Chain Monitoring System`,
    ].join('\n');

    if (blocked_party_email) {
        await _sendEmail(blocked_party_email, blocked_party_name, subject, body);
    }
}

// ============================================================================
// EMAIL SENDER (SIMULATION)
// ============================================================================
// Thay thế bằng nodemailer khi có SMTP thực.

/**
 * Gửi email (hiện tại: simulate bằng console.log).
 *
 * @param {string} toEmail   - Địa chỉ email người nhận
 * @param {string} toName    - Tên người nhận
 * @param {string} subject   - Tiêu đề email
 * @param {string} body      - Nội dung email (text)
 */
async function _sendEmail(toEmail, toName, subject, body) {
    // --- SIMULATION MODE ---
    // Thay thế bằng code thực bên dưới khi có SMTP server.
    console.log('');
    console.log('═'.repeat(60));
    console.log('[NotificationService] 📧 EMAIL SENT (simulation)');
    console.log('─'.repeat(60));
    console.log(`  To      : ${toName} <${toEmail}>`);
    console.log(`  Subject : ${subject}`);
    console.log('─'.repeat(60));
    console.log(body);
    console.log('═'.repeat(60));
    console.log('');

    // --- NODEMAILER (uncomment khi có SMTP) ---
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //     host: process.env.SMTP_HOST,
    //     port: Number(process.env.SMTP_PORT) || 587,
    //     secure: false,
    //     auth: {
    //         user: process.env.SMTP_USER,
    //         pass: process.env.SMTP_PASS,
    //     },
    // });
    // await transporter.sendMail({
    //     from: `"Supply Chain Monitor" <${process.env.SMTP_FROM}>`,
    //     to: `"${toName}" <${toEmail}>`,
    //     subject,
    //     text: body,
    // });
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Tạo nội dung email cho ALARM event.
 */
function _buildAlarmEmailBody({ shipment_id, alarm_reason, alarm_at, temp, temp_max, location }) {
    const alarmTime = alarm_at ? new Date(alarm_at).toISOString() : new Date().toISOString();
    const locationStr = location
        ? `[${location.lat?.toFixed(4)}, ${location.lng?.toFixed(4)}]`
        : 'Không xác định';

    return [
        `⚠️ CẢNH BÁO KHẨN CẤP - LÔ HÀNG BỊ ALARM`,
        ``,
        `Thông tin cảnh báo:`,
        `  • Shipment ID      : ${shipment_id}`,
        `  • Thời gian alarm  : ${alarmTime}`,
        `  • Lý do            : ${alarm_reason || 'Vi phạm điều kiện vận chuyển'}`,
        `  • Nhiệt độ ghi nhận: ${temp !== undefined ? `${temp}°C` : 'N/A'}`,
        `  • Giới hạn cho phép: ${temp_max !== undefined ? `${temp_max}°C` : 'N/A'}`,
        `  • Vị trí thiết bị  : ${locationStr}`,
        ``,
        `Toàn bộ hoạt động bàn giao lô hàng này đã bị TẠM KHÓA.`,
        ``,
        `Hành động cần thực hiện NGAY:`,
        `  1. Kiểm tra tình trạng hàng hóa`,
        `  2. Liên hệ đội vận chuyển`,
        `  3. Cập nhật trạng thái xử lý trong hệ thống`,
        ``,
        `Đây là email tự động từ hệ thống Supply Chain Monitoring.`,
        `Vui lòng KHÔNG trả lời email này.`,
    ].join('\n');
}

/**
 * Lấy thông tin email của một Party từ MySQL.
 * Dùng để bổ sung payload khi Saga Orchestrator không có sẵn email.
 *
 * @param {string} partyId
 * @returns {Promise<{email: string|null, name: string|null}>}
 */
async function getPartyContact(partyId) {
    if (!partyId) return { email: null, name: null };
    try {
        const [rows] = await pool.query(
            'SELECT Name, Email FROM Parties WHERE PartyID = ? LIMIT 1',
            [partyId]
        );
        if (rows.length === 0) return { email: null, name: null };
        return { email: rows[0].Email, name: rows[0].Name };
    } catch (err) {
        console.error(`[NotificationService] Failed to get contact for party ${partyId}:`, err.message);
        return { email: null, name: null };
    }
}

module.exports = {
    sendNotification,
    getPartyContact,
    MAX_RETRY,
};
