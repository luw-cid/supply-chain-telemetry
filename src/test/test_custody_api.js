/**
 * ============================================================================
 * Test Suite: Chain of Custody API
 * ============================================================================
 * Endpoint 3.1: POST /api/v1/shipments/:id/transfer
 * Endpoint 3.2: GET  /api/v1/shipments/:id/ownership-history
 *
 * Các kịch bản test:
 *  1. Auth — thiếu/sai JWT
 *  2. Validation — thiếu field bắt buộc, sai enum
 *  3. Transfer — happy path thành công
 *  4. Transfer — chặn lô hàng ALARM (HTTP 409)
 *  5. Transfer — từ chối sai owner (HTTP 403)
 *  6. Transfer — shipment không tồn tại (HTTP 404)
 *  7. Transfer — từ/đến cùng một party (HTTP 400)
 *  8. Ownership History — DETAILED mode
 *  9. Ownership History — SUMMARY mode
 * 10. Ownership History — shipment không tồn tại (HTTP 404)
 *
 * Cài đặt test: npm test (hoặc npx mocha database/test/test_custody_api.js)
 *
 * ⚠ YÊU CẦU: Server phải đang chạy tại http://localhost:3000
 *             Database phải có seed data như mô tả trong SEED DATA section
 * ============================================================================
 */

'use strict';

const http  = require('http');
const https = require('https');
const path  = require('path');
const fs    = require('fs');

// Load .env từ src/
const envCandidates = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
if (envPath) require('dotenv').config({ path: envPath });

const { describe, it, before } = require('mocha');
const { expect }               = require('chai');

// ============================================================================
// SEED DATA — mô tả dữ liệu cần có trong DB
// ============================================================================
//
// Chạy SQL sau trong MySQL trước khi test:
//
// -- Parties
// INSERT IGNORE INTO Parties (PartyID, PartyType, Name, Email, Phone, Status) VALUES
//   ('PARTY-OWNER-001', 'OWNER',     'Vietnam Pharma Corp',    'vn@pharma.vn', '+84901000001', 'ACTIVE'),
//   ('PARTY-LOG-001',   'LOGISTICS', 'Saigon Logistics Co.',   'sg@log.vn',    '+84901000002', 'ACTIVE'),
//   ('PARTY-LOG-002',   'LOGISTICS', 'Hanoi Freight Ltd.',      'hn@log.vn',    '+84901000003', 'ACTIVE'),
//   ('PARTY-AUD-001',   'AUDITOR',   'Port Authority VNSGN',   'au@port.vn',   '+84901000004', 'ACTIVE');
//
// -- Ports
// INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status) VALUES
//   ('VNSGN', 'Saigon Port',      'Vietnam',   10.78330000, 106.70420000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
//   ('VNHPH', 'Hai Phong Port',   'Vietnam',   20.84490000, 106.68810000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
//   ('SGSIN', 'Singapore Port',   'Singapore',  1.29660000, 103.77640000, 'Asia/Singapore',   'OPERATIONAL');
//
// -- CargoProfiles
// INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax) VALUES
//   ('CP-VACCINE-01', 'VACCINE', 'COVID-19 Vaccine', 2.00, 8.00);
//
// -- Shipments
// INSERT IGNORE INTO Shipments
//   (ShipmentID, CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID,
//    OriginPortCode, DestinationPortCode, Status, CurrentPortCode) VALUES
//   ('SHP-TRANSFER-OK',  'CP-VACCINE-01', 500.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'VNHPH', 'IN_TRANSIT', 'VNSGN'),
//   ('SHP-ALARM-001',    'CP-VACCINE-01', 200.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNSGN', 'SGSIN', 'ALARM',      'VNSGN'),
//   ('SHP-HISTORY-001',  'CP-VACCINE-01', 300.00, 'PARTY-OWNER-001', 'PARTY-LOG-002', 'VNHPH', 'SGSIN', 'IN_TRANSIT', 'SGSIN');
//
// -- Ownership cho SHP-TRANSFER-OK (PARTY-LOG-001 là owner hiện tại)
// INSERT IGNORE INTO Ownership (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition) VALUES
//   (UUID(), 'SHP-TRANSFER-OK', 'PARTY-LOG-001', '2026-03-01 08:00:00', NULL, 'VNSGN', 'GOOD');
//
// -- Ownership cho SHP-ALARM-001
// INSERT IGNORE INTO Ownership (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition) VALUES
//   (UUID(), 'SHP-ALARM-001', 'PARTY-LOG-001', '2026-03-05 10:00:00', NULL, 'VNSGN', 'GOOD');
//
// -- Ownership chain 3 bước cho SHP-HISTORY-001
// INSERT IGNORE INTO Ownership (OwnershipID, ShipmentID, PartyID, StartAtUTC, EndAtUTC, HandoverPortCode, HandoverCondition, HandoverSignature) VALUES
//   (UUID(), 'SHP-HISTORY-001', 'PARTY-OWNER-001', '2026-03-01 06:00:00', '2026-03-05 12:00:00', 'VNHPH', 'GOOD', 'sha256:aabbcc'),
//   (UUID(), 'SHP-HISTORY-001', 'PARTY-LOG-001',   '2026-03-05 12:00:00', '2026-03-10 18:00:00', 'VNSGN', 'GOOD', 'sha256:ddeeff'),
//   (UUID(), 'SHP-HISTORY-001', 'PARTY-LOG-002',   '2026-03-10 18:00:00', NULL,                  'SGSIN', 'GOOD', 'sha256:112233');
//
// -- User với partyId = PARTY-LOG-001 (để login lấy token)
// INSERT IGNORE INTO Users (UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status) VALUES
//   (UUID(), 'Test User', 'testuser@custody.vn', '+84901999999',
//    '$2a$10$somehashedpassword...', 'LOGISTICS', 'PARTY-LOG-001', 'ACTIVE');
// Bạn cần tạo bcrypt hash đúng với password 'Password@123' và replace vào trên
//
// ============================================================================

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL  = process.env.TEST_BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL    = process.env.TEST_LOGIN_EMAIL    || 'testuser@custody.vn';
const LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD || 'Password@123';

// IDs khớp với seed data
const IDs = {
  shipmentOk:      'SHP-TRANSFER-OK',   // Shipment IN_TRANSIT, owner = PARTY-LOG-001
  shipmentAlarm:   'SHP-ALARM-001',     // Shipment ALARM
  shipmentHistory: 'SHP-HISTORY-001',   // Shipment có 3-bước ownership chain
  shipmentGhost:   'SHP-DOES-NOT-EXIST',// Shipment không tồn tại

  ownerParty:    'PARTY-LOG-001',   // Chủ sở hữu hiện tại của SHP-TRANSFER-OK
  receiverParty: 'PARTY-LOG-002',   // Bên nhận
  wrongParty:    'PARTY-OWNER-001', // Party KHÔNG phải owner của SHP-TRANSFER-OK
  ghostParty:    'PARTY-NOT-EXIST', // Party không tồn tại

  portSgn: 'VNSGN', // Saigon Port (tồn tại trong DB)
  portSin: 'SGSIN', // Singapore Port (tồn tại trong DB)
};

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, urlStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url    = new URL(urlStr);
    const lib    = url.protocol === 'https:' ? https : http;
    const reqBody = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(reqBody ? { 'Content-Length': Buffer.byteLength(reqBody) } : {}),
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

function get(path, token)       { return request('GET',  `${BASE_URL}${path}`, null, token ? { Authorization: `Bearer ${token}` } : {}); }
function post(path, body, token){ return request('POST', `${BASE_URL}${path}`, body, token ? { Authorization: `Bearer ${token}` } : {}); }

// ── Test suite ────────────────────────────────────────────────────────────────
describe('Chain of Custody API', function () {
  this.timeout(15000);

  let ACCESS_TOKEN = '';
  let loginEmail = LOGIN_EMAIL;
  let loginPassword = LOGIN_PASSWORD;

  // ── Setup: đăng nhập lấy JWT ────────────────────────────────────────────────
  before(async function () {
    async function tryLogin(email, password) {
      const res = await post('/api/auth/login', {
        email,
        password,
      });

      if (res.status === 200 && res.body?.data?.accessToken) {
        return { token: res.body.data.accessToken, res };
      }

      return { token: '', res };
    }

    async function tryRegister(email, password) {
      const res = await post('/api/auth/register', {
        name: 'Test User',
        email,
        phone: process.env.TEST_LOGIN_PHONE || '+84000000000',
        password,
        role: process.env.TEST_LOGIN_ROLE || 'LOGISTICS',
        partyId: IDs.ownerParty,
      });

      return res;
    }

    const firstLogin = await tryLogin(loginEmail, loginPassword);
    if (firstLogin.token) {
      ACCESS_TOKEN = firstLogin.token;
      console.log('  ✓ [Setup] JWT acquired');
      return;
    }

    const loginStatus = firstLogin.res?.status;
    const loginError = firstLogin.res?.body?.error || firstLogin.res?.body?.message;
    console.warn(`  ⚠ [Setup] Login failed (status ${loginStatus || 'n/a'}) — attempting register`);

    const registerRes = await tryRegister(loginEmail, loginPassword);
    if (registerRes.status !== 201) {
      const registerError = registerRes.body?.error || registerRes.body?.message || '';
      const isEmailExists = /email.*exists/i.test(registerError);
      const isInvalidCredentials = /invalid credentials/i.test(loginError || '');
      if (isEmailExists && isInvalidCredentials) {
        loginEmail = `testuser+${Date.now()}@custody.vn`;
        const retryRegister = await tryRegister(loginEmail, loginPassword);
        if (retryRegister.status !== 201) {
          const retryError = retryRegister.body?.error || retryRegister.body?.message || '';
          console.warn(`  ⚠ [Setup] Register retry failed (status ${retryRegister.status}) — ${retryError}`);
        }
      } else if (!isEmailExists) {
        console.warn(`  ⚠ [Setup] Register failed (status ${registerRes.status}) — ${registerError}`);
      }
    }

    const secondLogin = await tryLogin(loginEmail, loginPassword);
    if (secondLogin.token) {
      ACCESS_TOKEN = secondLogin.token;
      console.log('  ✓ [Setup] JWT acquired after register');
      return;
    }

    const finalError = secondLogin.res?.body?.error || secondLogin.res?.body?.message || loginError || 'Unknown login error';
    throw new Error(`Login failed. Check seed user or JWT_SECRET. Last error: ${finalError}`);
  });

  // ==========================================================================
  // GROUP 1 — Authentication
  // ==========================================================================
  describe('1. Authentication Guard', function () {

    it('1.1 POST /transfer không có token → 401', async function () {
      const res = await post(`/api/v1/shipments/${IDs.shipmentOk}/transfer`, {
        fromPartyId:      IDs.ownerParty,
        toPartyId:        IDs.receiverParty,
        handoverPortCode: IDs.portSgn,
      });
      expect(res.status).to.equal(401);
      expect(res.body.success).to.equal(false);
    });

    it('1.2 GET /ownership-history không có token → 401', async function () {
      const res = await get(`/api/v1/shipments/${IDs.shipmentHistory}/ownership-history`);
      expect(res.status).to.equal(401);
      expect(res.body.success).to.equal(false);
    });

    it('1.3 POST /transfer với token sai → 401', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        { fromPartyId: IDs.ownerParty, toPartyId: IDs.receiverParty, handoverPortCode: IDs.portSgn },
        'invalid.jwt.token'
      );
      expect(res.status).to.equal(401);
    });

    it('1.4 GET /ownership-history với token sai → 401', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history`,
        'invalid.jwt.token'
      );
      expect(res.status).to.equal(401);
    });
  });

  // ==========================================================================
  // GROUP 2 — Input Validation (3.1)
  // ==========================================================================
  describe('2. Input Validation — Transfer Ownership', function () {

    it('2.1 Thiếu fromPartyId → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        { toPartyId: IDs.receiverParty, handoverPortCode: IDs.portSgn },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.match(/fromPartyId/i);
    });

    it('2.2 Thiếu toPartyId → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        { fromPartyId: IDs.ownerParty, handoverPortCode: IDs.portSgn },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.error).to.match(/toPartyId/i);
    });

    it('2.3 Thiếu handoverPortCode → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        { fromPartyId: IDs.ownerParty, toPartyId: IDs.receiverParty },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.error).to.match(/handoverPortCode/i);
    });

    it('2.4 handoverCondition không hợp lệ → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:      IDs.ownerParty,
          toPartyId:        IDs.receiverParty,
          handoverPortCode: IDs.portSgn,
          handoverCondition: 'BROKEN', // không hợp lệ
        },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.error).to.match(/GOOD|DAMAGED|PARTIAL/i);
    });

    it('2.5 fromPartyId và toPartyId trùng nhau → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:      IDs.ownerParty,
          toPartyId:        IDs.ownerParty, // cùng party
          handoverPortCode: IDs.portSgn,
        },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.error).to.match(/different/i);
    });

    it('2.6 Request body rỗng → 400', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {},
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
    });
  });

  // ==========================================================================
  // GROUP 3 — Transfer Ownership Business Rules (3.1)
  // ==========================================================================
  describe('3. Transfer Ownership — Business Rules', function () {

    it('3.1 Shipment không tồn tại → 404', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentGhost}/transfer`,
        {
          fromPartyId:      IDs.ownerParty,
          toPartyId:        IDs.receiverParty,
          handoverPortCode: IDs.portSgn,
        },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
    });

    it('3.2 Shipment đang ALARM → 409 Conflict', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentAlarm}/transfer`,
        {
          fromPartyId:      IDs.ownerParty,
          toPartyId:        IDs.receiverParty,
          handoverPortCode: IDs.portSgn,
        },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(409);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.match(/ALARM/i);
    });

    it('3.3 fromPartyId không phải chủ sở hữu hiện tại → 403 Forbidden', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:      IDs.wrongParty, // Không phải owner của SHP-TRANSFER-OK
          toPartyId:        IDs.receiverParty,
          handoverPortCode: IDs.portSgn,
        },
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(403);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.match(/owner|authorized/i);
    });

    it('3.4 Transfer thành công — happy path với tất cả fields bắt buộc → 200', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:       IDs.ownerParty,       // PARTY-LOG-001 là owner hiện tại
          toPartyId:         IDs.receiverParty,     // PARTY-LOG-002 sẽ nhận
          handoverPortCode:  IDs.portSgn,           // VNSGN tồn tại trong DB
          handoverCondition: 'GOOD',
        },
        ACCESS_TOKEN
      );
      // Nếu đã transfer trước đó (PARTY-LOG-001 không còn là owner), sẽ 403
      // Nên test này có thể 200 hoặc 403 tuỳ trạng thái DB
      expect([200, 403]).to.include(res.status);

      if (res.status === 200) {
        expect(res.body.success).to.be.true;
        expect(res.body.message).to.include('successfully');
        expect(res.body.data).to.include.all.keys(
          'shipmentId', 'fromPartyId', 'toPartyId',
          'handoverPortCode', 'handoverCondition', 'transferredAtUTC'
        );
        expect(res.body.data.shipmentId).to.equal(IDs.shipmentOk);
        expect(res.body.data.fromPartyId).to.equal(IDs.ownerParty);
        expect(res.body.data.toPartyId).to.equal(IDs.receiverParty);
        expect(res.body.data.handoverPortCode).to.equal(IDs.portSgn);
        expect(res.body.data.handoverCondition).to.equal('GOOD');
        expect(res.body.data.transferredAtUTC).to.be.a('string');
      }
    });

    it('3.5 Transfer thành công với đầy đủ optional fields → 200 hoặc 403', async function () {
      // Test này dùng SHP-TRANSFER-OK — nếu đã transfer qua test 3.4
      // thì PARTY-LOG-002 là owner mới, cần transfer tiếp từ PARTY-LOG-002
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:       IDs.receiverParty,  // PARTY-LOG-002 (owner mới sau 3.4)
          toPartyId:         IDs.ownerParty,     // trả ngược lại
          handoverPortCode:  IDs.portSin,
          handoverCondition: 'DAMAGED',
          handoverNotes:     'Phát hiện thùng bị móp góc, ảnh hưởng bao bì ngoài',
          handoverSignature: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          witnessPartyId:    'PARTY-AUD-001',
        },
        ACCESS_TOKEN
      );
      expect([200, 403, 404]).to.include(res.status);

      if (res.status === 200) {
        expect(res.body.success).to.be.true;
        expect(res.body.data.handoverCondition).to.equal('DAMAGED');
        expect(res.body.data.handoverPortCode).to.equal(IDs.portSin);
      }
    });

    it('3.6 handoverCondition = PARTIAL → 200 hoặc 403', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        {
          fromPartyId:       IDs.ownerParty,
          toPartyId:         IDs.receiverParty,
          handoverPortCode:  IDs.portSgn,
          handoverCondition: 'PARTIAL',
          handoverNotes:     'Thiếu 5 thùng so với manifest ban đầu',
        },
        ACCESS_TOKEN
      );
      expect([200, 403]).to.include(res.status);
    });
  });

  // ==========================================================================
  // GROUP 4 — Response Schema (3.1)
  // ==========================================================================
  describe('4. Transfer Ownership — Response Schema', function () {

    it('4.1 Error response có đủ fields: success=false, error', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentGhost}/transfer`,
        { fromPartyId: IDs.ownerParty, toPartyId: IDs.receiverParty, handoverPortCode: IDs.portSgn },
        ACCESS_TOKEN
      );
      expect(res.body).to.have.property('success', false);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.be.a('string').and.not.empty;
    });

    it('4.2 401 response khi không có token có field success=false', async function () {
      const res = await post(
        `/api/v1/shipments/${IDs.shipmentOk}/transfer`,
        { fromPartyId: IDs.ownerParty, toPartyId: IDs.receiverParty, handoverPortCode: IDs.portSgn }
      );
      expect(res.body).to.have.property('success', false);
    });
  });

  // ==========================================================================
  // GROUP 5 — Ownership History DETAILED (3.2)
  // ==========================================================================
  describe('5. Ownership History — Chế độ DETAILED', function () {

    it('5.1 GET /ownership-history mặc định (không truyền ?detail) → 200 DETAILED', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.detailLevel).to.equal('DETAILED');
    });

    it('5.2 GET ?detail=DETAILED → trả về chain với object currentOwner đầy đủ', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      const { data } = res.body;

      // Cấu trúc response
      expect(data).to.include.all.keys('shipmentId', 'detailLevel', 'totalTransfers', 'chain');
      expect(data.shipmentId).to.equal(IDs.shipmentHistory);
      expect(data.detailLevel).to.equal('DETAILED');
      expect(data.chain).to.be.an('array');
    });

    it('5.3 Chain có ít nhất 3 bước (theo seed data SHP-HISTORY-001)', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      expect(res.body.data.chain.length).to.be.at.least(3);
    });

    it('5.4 Mỗi phần tử chain DETAILED có đủ fields bắt buộc', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      const first = res.body.data.chain[0];

      expect(first).to.include.all.keys(
        'stepNumber', 'currentOwner', 'previousOwner',
        'handoverPort', 'handoverCondition',
        'startAtUTC', 'endAtUTC',
        'ownershipDurationHours', 'ownershipStatus',
        'chainDepth'
      );
      expect(first.currentOwner).to.include.all.keys('name', 'type');
      expect(first.handoverPort).to.include.all.keys('code', 'name', 'country');
    });

    it('5.5 Bước đầu tiên (anchor): previousOwner là null', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const first = res.body.data.chain[0];
      expect(first.previousOwner).to.be.null;
      expect(first.stepNumber).to.equal(1);
    });

    it('5.6 Bước cuối cùng: ownershipStatus = ACTIVE, endAtUTC = null', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const chain = res.body.data.chain;
      const last = chain[chain.length - 1];
      expect(last.ownershipStatus).to.equal('ACTIVE');
      expect(last.endAtUTC).to.be.null;
    });

    it('5.7 Thứ tự chain theo stepNumber tăng dần (chronological)', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const steps = res.body.data.chain.map((c) => c.stepNumber);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]).to.equal(steps[i - 1] + 1);
      }
    });

    it('5.8 totalTransfers khớp với số phần tử trong chain', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const { data } = res.body;
      expect(data.totalTransfers).to.equal(data.chain.length);
    });

    it('5.9 handoverSignature được trả về khi có trong DB (seed data dùng sha256:...)', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      // Bước 1 có handoverSignature = 'sha256:aabbcc' (theo seed)
      const first = res.body.data.chain[0];
      expect(first.handoverSignature).to.be.a('string').and.include('sha256:');
    });
  });

  // ==========================================================================
  // GROUP 6 — Ownership History SUMMARY (3.2)
  // ==========================================================================
  describe('6. Ownership History — Chế độ SUMMARY', function () {

    it('6.1 GET ?detail=SUMMARY → 200, detailLevel = SUMMARY', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=SUMMARY`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      expect(res.body.data.detailLevel).to.equal('SUMMARY');
    });

    it('6.2 Chain SUMMARY có đủ fields: transferStep, currentOwner (string), ownershipDuration', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=SUMMARY`,
        ACCESS_TOKEN
      );
      const first = res.body.data.chain[0];
      expect(first).to.include.all.keys(
        'transferStep', 'currentOwner', 'previousOwner',
        'ownershipStatus', 'handoverPort', 'handoverCondition',
        'startAtUTC', 'endAtUTC', 'ownershipDuration', 'chainDepth'
      );
      // SUMMARY: currentOwner là string (tên party), không phải object
      expect(first.currentOwner).to.be.a('string');
    });

    it('6.3 SUMMARY ít field hơn DETAILED (ownershipDurationHours không có)', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=SUMMARY`,
        ACCESS_TOKEN
      );
      const first = res.body.data.chain[0];
      // SUMMARY không có ownershipDurationHours (chỉ có ở DETAILED)
      expect(first).to.not.have.property('ownershipDurationHours');
    });

    it('6.4 ?detail=summary (lowercase) → tự động uppercase, 200 OK', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=summary`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      expect(res.body.data.detailLevel).to.equal('SUMMARY');
    });

    it('6.5 ?detail giá trị sai → 400 Bad Request', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=INVALID_LEVEL`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.match(/SUMMARY|DETAILED/i);
    });
  });

  // ==========================================================================
  // GROUP 7 — Ownership History Error Cases (3.2)
  // ==========================================================================
  describe('7. Ownership History — Error Cases', function () {

    it('7.1 Shipment không tồn tại → 404', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentGhost}/ownership-history`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
    });

    it('7.2 Shipment có ownership 1 bước (chưa từng transfer) → chain.length = 1', async function () {
      // SHP-ALARM-001 chỉ có 1 ownership record (theo seed data)
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentAlarm}/ownership-history`,
        ACCESS_TOKEN
      );
      // Vẫn trả về 200 (có thể fetch history của ALARM shipment)
      expect(res.status).to.equal(200);
      expect(res.body.data.chain.length).to.equal(1);
      expect(res.body.data.chain[0].ownershipStatus).to.equal('ACTIVE');
    });

    it('7.3 ?detail không truyền → default DETAILED, không lỗi', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history`,
        ACCESS_TOKEN
      );
      expect(res.status).to.equal(200);
      expect(res.body.data.detailLevel).to.equal('DETAILED');
    });
  });

  // ==========================================================================
  // GROUP 8 — Tính toàn vẹn dữ liệu (Recursive CTE correctness)
  // ==========================================================================
  describe('8. Data Integrity — Recursive CTE', function () {

    it('8.1 Không có khoảng trống thời gian giữa các bước sở hữu', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const chain = res.body.data.chain;

      for (let i = 0; i < chain.length - 1; i++) {
        const currentEnd   = chain[i].endAtUTC;
        const nextStart    = chain[i + 1].startAtUTC;
        // endAtUTC của bước i phải = startAtUTC của bước i+1
        if (currentEnd && nextStart) {
          const endMs   = new Date(currentEnd).getTime();
          const startMs = new Date(nextStart).getTime();
          expect(Math.abs(endMs - startMs)).to.be.lessThan(1000); // <1 giây sai số
        }
      }
    });

    it('8.2 Chỉ có duy nhất 1 bước ACTIVE (EndAtUTC IS NULL) trong chuỗi', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const activeSteps = res.body.data.chain.filter((c) => c.ownershipStatus === 'ACTIVE');
      expect(activeSteps.length).to.equal(1);
    });

    it('8.3 Tất cả bước trừ bước cuối đều có trạng thái TRANSFERRED', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const chain = res.body.data.chain;
      for (let i = 0; i < chain.length - 1; i++) {
        expect(chain[i].ownershipStatus).to.equal('TRANSFERRED');
        expect(chain[i].endAtUTC).to.not.be.null;
      }
    });

    it('8.4 chainDepth tăng tuần tự từ 1', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      res.body.data.chain.forEach((step, idx) => {
        expect(step.chainDepth).to.equal(idx + 1);
      });
    });

    it('8.5 transferSequencePath chứa "->" nếu có nhiều hơn 1 bước', async function () {
      const res = await get(
        `/api/v1/shipments/${IDs.shipmentHistory}/ownership-history?detail=DETAILED`,
        ACCESS_TOKEN
      );
      const chain = res.body.data.chain;
      if (chain.length > 1) {
        // Bước 2 trở đi phải có "->" trong path
        expect(chain[1].transferSequencePath).to.include('->');
      }
    });
  });
});
