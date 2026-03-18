# Chain of Custody API — Tài liệu kỹ thuật

> **Nhóm 3 — Chuỗi Sở Hữu**  
> Cơ sở dữ liệu chính: **MySQL** (Bảng `Ownership`, Stored Procedures)  
> Ngày tạo: 2026-03-18

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Sơ đồ luồng xử lý](#2-sơ-đồ-luồng-xử-lý)
3. [3.1 Transfer Ownership](#31-transfer-ownership)
4. [3.2 Ownership History](#32-ownership-history)
5. [Error Reference](#5-error-reference)
6. [Ví dụ curl](#6-ví-dụ-curl)

---

## 1. Tổng quan kiến trúc

```
Client
  │
  ▼  HTTP Request (Bearer JWT)
[Express Router]  src/routes/custody.route.js
  │
  ▼  authenticate middleware (JWT verify)
[Controller]      src/controllers/custody.controller.js
  │
  ▼  Business logic + validation
[Service]         src/services/custody.service.js
  │
  ├─► CALL sp_change_custody(...)             ── 3.1 Transfer
  │       SET @out / SELECT @out (mysql2 OUT param pattern)
  │
  └─► CALL SP_TraceChainOfCustodyRecursive(…) ── 3.2 History
          Recursive CTE, 2 chế độ: SUMMARY | DETAILED
  │
  ▼
MySQL pool  (mysql2/promise)  src/configs/sql.config.js
```

### Các file liên quan

| File | Vai trò |
|------|---------|
| `src/routes/custody.route.js` | Khai báo 2 endpoints, gắn middleware `authenticate` |
| `src/controllers/custody.controller.js` | Đọc request → gọi service → format response |
| `src/services/custody.service.js` | Validate input, gọi SP, map lỗi SP → HTTP |
| `src/database/sql/sp_change_custody.sql` | SP MySQL thực hiện Transaction nguyên tử bàn giao |
| `src/database/sql/recursive_cte_chain_of_custody.sql` | SP MySQL với Recursive CTE truy vết chuỗi sở hữu |

---

## 2. Sơ đồ luồng xử lý

### 3.1 Transfer Ownership

```
POST /api/v1/shipments/:id/transfer
          │
          ├── [MW] authenticate → 401 nếu thiếu/sai JWT
          │
          ├── [SVC] Validate input
          │       fromPartyId, toPartyId, handoverPortCode required
          │       handoverCondition ∈ {GOOD, DAMAGED, PARTIAL}
          │       fromPartyId ≠ toPartyId
          │
          ├── [DB]  SET @p_success=0, @p_message=NULL
          ├── [DB]  CALL sp_change_custody(8 IN params, @p_success OUT, @p_message OUT)
          │
          │   ┌─ Bên trong SP (Transaction nguyên tử) ─────────────────────────┐
          │   │ 1. Kiểm tra Shipment tồn tại                                   │
          │   │ 2. Kiểm tra Status ≠ 'ALARM'  ─── chặn nếu ALARM              │
          │   │ 3. Lấy Ownership đang active (EndAtUTC IS NULL)                │
          │   │ 4. Kiểm tra PartyID == fromPartyId ─── từ chối nếu sai owner  │
          │   │ 5. START TRANSACTION                                            │
          │   │    UPDATE Ownership SET EndAtUTC=NOW()... (đóng record cũ)     │
          │   │    INSERT Ownership (tạo record mới cho toPartyId)             │
          │   │    UPDATE Shipments SET CurrentPortCode=...                    │
          │   │    COMMIT / ROLLBACK                                           │
          │   └───────────────────────────────────────────────────────────────┘
          │
          ├── [DB]  SELECT @p_success, @p_message
          │
          ├── [SVC] @p_success = 0 → map SP message → HTTP error (400/403/404/409)
          └── [SVC] @p_success = 1 → trả 200 OK + data
```

### 3.2 Ownership History (Recursive CTE)

```
GET /api/v1/shipments/:id/ownership-history?detail=DETAILED
          │
          ├── [MW] authenticate → 401 nếu thiếu/sai JWT
          │
          ├── [SVC] Validate shipmentId, detailLevel ∈ {SUMMARY, DETAILED}
          │
          ├── [DB]  CALL SP_TraceChainOfCustodyRecursive(shipmentId, detailLevel)
          │
          │   ┌─ Bên trong SP — Recursive CTE ─────────────────────────────────┐
          │   │                                                                  │
          │   │  WITH RECURSIVE cte AS (                                        │
          │   │    -- ANCHOR: bản ghi ownership có StartAtUTC nhỏ nhất         │
          │   │    SELECT ... FROM Ownership WHERE ShipmentID=? AND            │
          │   │           StartAtUTC = (SELECT MIN(StartAtUTC) ...)            │
          │   │                                                                  │
          │   │    UNION ALL                                                     │
          │   │                                                                  │
          │   │    -- RECURSIVE: tìm bản ghi tiếp theo theo thời gian          │
          │   │    SELECT ... FROM cte                                          │
          │   │    JOIN Ownership o_next ON o_next.StartAtUTC = (              │
          │   │      SELECT MIN(StartAtUTC) FROM Ownership                      │
          │   │      WHERE ShipmentID=cte.ShipmentID AND StartAtUTC > cte.StartAtUTC │
          │   │    ) WHERE cte.chain_depth < 100  -- chống đệ quy vô hạn      │
          │   │  )                                                               │
          │   │  SELECT ... ORDER BY step_number ASC;                           │
          │   └──────────────────────────────────────────────────────────────────┘
          │
          ├── [SVC] SP SIGNAL → notFound / badRequest
          └── [SVC] Chuẩn hoá rows → camelCase → 200 OK
```

> **Tại sao Recursive CTE?**  
> Chuỗi sở hữu có tính tuyến tính: mỗi bản ghi `Ownership` kết nối với bản ghi
> kế tiếp qua trường `StartAtUTC`. Recursive CTE cho phép MySQL tự "leo" qua toàn
> bộ chuỗi trong **1 truy vấn duy nhất**, đảm bảo không có khoảng trống hay
> chồng chéo, và không cần N round-trip giữa Node và DB.

---

## 3.1 Transfer Ownership

### Endpoint

```
POST /api/v1/shipments/:id/transfer
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Request Parameters

| Tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---------|--------|------|----------|-------|
| `id` | URL param | string | ✅ | ShipmentID |
| `fromPartyId` | body | string | ✅ | Bên chuyển giao — phải là chủ sở hữu hiện tại |
| `toPartyId` | body | string | ✅ | Bên nhận quyền sở hữu |
| `handoverPortCode` | body | string | ✅ | Mã cảng bàn giao (vd: `VNSGN`) |
| `handoverCondition` | body | enum | ❌ | `GOOD` \| `DAMAGED` \| `PARTIAL` (default: `GOOD`) |
| `handoverNotes` | body | string | ❌ | Ghi chú tự do |
| `handoverSignature` | body | string | ❌ | Hash chữ ký số (vd: `sha256:abc123...`) |
| `witnessPartyId` | body | string | ❌ | PartyID bên chứng kiến |

### Request Body (ví dụ)

```json
{
  "fromPartyId": "PARTY-LOG-001",
  "toPartyId": "PARTY-LOG-002",
  "handoverPortCode": "VNSGN",
  "handoverCondition": "GOOD",
  "handoverNotes": "Hàng nguyên vẹn, kiểm tra tại cảng lúc 14:30",
  "handoverSignature": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "witnessPartyId": "PARTY-WIT-001"
}
```

### Response 200 OK

```json
{
  "success": true,
  "message": "Custody transfer completed successfully",
  "data": {
    "shipmentId": "SHP-2024-001234",
    "fromPartyId": "PARTY-LOG-001",
    "toPartyId": "PARTY-LOG-002",
    "handoverPortCode": "VNSGN",
    "handoverCondition": "GOOD",
    "transferredAtUTC": "2026-03-18T08:12:00.000Z"
  }
}
```

### Logic bên trong SP (`sp_change_custody`)

Toàn bộ thực thi diễn ra trong **1 SQL Transaction nguyên tử**:

```
START TRANSACTION
  ① UPDATE Ownership SET EndAtUTC = NOW(), HandoverPortCode, HandoverCondition,
                         HandoverNotes, HandoverSignature, WitnessPartyID
     WHERE OwnershipID = <active_record>          -- đóng record sở hữu cũ

  ② INSERT INTO Ownership (UUID, ShipmentID, toPartyID, NOW(), NULL, ...)
                                                  -- tạo record sở hữu mới

  ③ UPDATE Shipments SET CurrentPortCode = handoverPortCode,
                         CurrentLocation = (SELECT Name FROM Ports …)
                                                  -- cập nhật vị trí lô hàng
COMMIT  (hoặc ROLLBACK nếu bất kỳ bước nào thất bại)
```

---

## 3.2 Ownership History

### Endpoint

```
GET /api/v1/shipments/:id/ownership-history?detail=DETAILED
Authorization: Bearer <JWT>
```

### Request Parameters

| Tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---------|--------|------|----------|-------|
| `id` | URL param | string | ✅ | ShipmentID |
| `detail` | query | enum | ❌ | `SUMMARY` \| `DETAILED` (default: `DETAILED`) |

### Response 200 OK — chế độ DETAILED

```json
{
  "success": true,
  "data": {
    "shipmentId": "SHP-2024-001234",
    "detailLevel": "DETAILED",
    "totalTransfers": 3,
    "chain": [
      {
        "stepNumber": 1,
        "currentOwner": {
          "name": "Logistics Alpha Co.",
          "type": "LOGISTICS",
          "email": "ops@alpha.com",
          "phone": "+84901234567",
          "address": "123 Nguyen Hue, HCMC"
        },
        "previousOwner": null,
        "handoverPort": {
          "code": "VNHPH",
          "name": "Hai Phong Port",
          "country": "Vietnam",
          "latitude": 20.8449,
          "longitude": 106.6881,
          "timezone": "Asia/Ho_Chi_Minh"
        },
        "handoverCondition": "GOOD",
        "handoverNotes": null,
        "handoverSignature": "sha256:abc...",
        "witness": null,
        "startAtUTC": "2026-03-01T09:00:00.000000Z",
        "endAtUTC": "2026-03-10T14:30:00.000000Z",
        "ownershipDurationHours": 221,
        "ownershipStatus": "TRANSFERRED",
        "transferSequencePath": "2026-03-01 09:00:00.000000",
        "chainDepth": 1
      },
      {
        "stepNumber": 2,
        "currentOwner": {
          "name": "Ocean Freight Ltd.",
          "type": "CARRIER",
          "email": "cargo@ocean.com",
          "phone": "+6591234567",
          "address": "1 Maritime Square, Singapore"
        },
        "previousOwner": {
          "name": "Logistics Alpha Co.",
          "type": "LOGISTICS"
        },
        "handoverPort": {
          "code": "SGSIN",
          "name": "Singapore Port",
          "country": "Singapore",
          "latitude": 1.2966,
          "longitude": 103.7764,
          "timezone": "Asia/Singapore"
        },
        "handoverCondition": "GOOD",
        "handoverNotes": "Chuyển sang tàu MV Freedom",
        "handoverSignature": "sha256:def...",
        "witness": {
          "name": "Port Authority SG",
          "type": "AUTHORITY"
        },
        "startAtUTC": "2026-03-10T14:30:00.000000Z",
        "endAtUTC": null,
        "ownershipDurationHours": 200,
        "ownershipStatus": "ACTIVE",
        "transferSequencePath": "2026-03-01 09:00:00.000000 -> 2026-03-10 14:30:00.000000",
        "chainDepth": 2
      }
    ]
  }
}
```

### Response 200 OK — chế độ SUMMARY

```json
{
  "success": true,
  "data": {
    "shipmentId": "SHP-2024-001234",
    "detailLevel": "SUMMARY",
    "totalTransfers": 2,
    "chain": [
      {
        "transferStep": 1,
        "currentOwner": "Logistics Alpha Co.",
        "previousOwner": null,
        "ownershipStatus": "TRANSFERRED",
        "handoverPort": "Hai Phong Port",
        "handoverCondition": "GOOD",
        "startAtUTC": "2026-03-01T09:00:00.000000Z",
        "endAtUTC": "2026-03-10T14:30:00.000000Z",
        "ownershipDuration": "221:30:00",
        "chainDepth": 1
      },
      {
        "transferStep": 2,
        "currentOwner": "Ocean Freight Ltd.",
        "previousOwner": "Logistics Alpha Co.",
        "ownershipStatus": "ACTIVE",
        "handoverPort": "Singapore Port",
        "handoverCondition": "GOOD",
        "startAtUTC": "2026-03-10T14:30:00.000000Z",
        "endAtUTC": null,
        "ownershipDuration": "200:00:00",
        "chainDepth": 2
      }
    ]
  }
}
```

---

## 5. Error Reference

### HTTP Status Codes

| HTTP | Nguyên nhân | Ví dụ message |
|------|-------------|---------------|
| `400 Bad Request` | Thiếu field bắt buộc / sai enum | `"fromPartyId is required"` |
| `401 Unauthorized` | Thiếu hoặc JWT hết hạn | `"Missing bearer token"` |
| `403 Forbidden` | `fromPartyId` không phải chủ sở hữu hiện tại | `"FromPartyID is not the current owner - transfer not authorized"` |
| `404 Not Found` | ShipmentID không tồn tại / không có ownership nào active | `"Shipment not found"` |
| `409 Conflict` | Lô hàng đang bị khoá ở trạng thái ALARM | `"Shipment is in ALARM status - custody transfer blocked until resolved"` |
| `500 Internal Server Error` | Lỗi database không mong muốn | `"Internal server error"` |

### Error Response Format

```json
{
  "success": false,
  "error": "<mô tả lỗi>"
}
```

### Logic map lỗi SP → HTTP (trong `custody.service.js`)

```
SP p_message contains "not found"          → 404 Not Found
SP p_message contains "ALARM"              → 409 Conflict
SP p_message contains "not the current owner" → 403 Forbidden
SP p_message contains "is required"        → 400 Bad Request
SP SIGNAL SQLSTATE '45000'                 → 404 Not Found (không tìm thấy shipment)
```

---

## 6. Ví dụ curl

### Lấy JWT token

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  | jq -r '.data.accessToken'
```

### 3.1 Transfer Ownership — Happy Path

```bash
TOKEN="<paste_token_here>"

curl -s -X POST http://localhost:3000/api/v1/shipments/SHP-001/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromPartyId": "PARTY-LOG-001",
    "toPartyId": "PARTY-LOG-002",
    "handoverPortCode": "VNSGN",
    "handoverCondition": "GOOD",
    "handoverNotes": "Hàng nguyên vẹn",
    "handoverSignature": "sha256:e3b0c44298fc..."
  }' | jq .
```

### 3.1 Kiểm tra chặn ALARM

```bash
# Lô hàng ALARM-001 phải có Status='ALARM' trong DB
curl -s -X POST http://localhost:3000/api/v1/shipments/ALARM-001/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromPartyId":"PARTY-001","toPartyId":"PARTY-002","handoverPortCode":"VNSGN"}' \
  | jq .
# Mong đợi: HTTP 409
```

### 3.1 Kiểm tra từ chối sai owner

```bash
curl -s -X POST http://localhost:3000/api/v1/shipments/SHP-001/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromPartyId":"WRONG-PARTY","toPartyId":"PARTY-002","handoverPortCode":"VNSGN"}' \
  | jq .
# Mong đợi: HTTP 403
```

### 3.2 Ownership History — DETAILED

```bash
curl -s "http://localhost:3000/api/v1/shipments/SHP-001/ownership-history?detail=DETAILED" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 3.2 Ownership History — SUMMARY

```bash
curl -s "http://localhost:3000/api/v1/shipments/SHP-001/ownership-history?detail=SUMMARY" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Kiểm tra 401 (không có token)

```bash
curl -s -X POST http://localhost:3000/api/v1/shipments/SHP-001/transfer \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Mong đợi: HTTP 401  { "success": false, "error": "Missing bearer token" }
```
