const AppError = require('../utils/app-error');
const portRepository = require('../repositories/port.repository');

const STATUSES = new Set(['OPERATIONAL', 'CLOSED', 'RESTRICTED']);

function normalizePortCode(code) {
  if (code == null || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

function validateStatus(status) {
  if (!STATUSES.has(status)) {
    throw AppError.badRequest(`Status must be one of: ${[...STATUSES].join(', ')}`);
  }
}

async function listPortsForUser({ role, includeAllRequested, forMap }) {
  if (forMap) {
    return portRepository.listPortsWithCoordinates();
  }
  const includeAll = includeAllRequested && role === 'ADMIN';
  return portRepository.listPorts({ includeAll });
}

async function createPort(body) {
  const portCode = normalizePortCode(body.portCode ?? body.PortCode);
  const name = typeof body.name === 'string' ? body.name.trim() : typeof body.Name === 'string' ? body.Name.trim() : '';
  const country =
    typeof body.country === 'string'
      ? body.country.trim()
      : typeof body.Country === 'string'
        ? body.Country.trim()
        : '';

  if (!portCode || portCode.length > 16) {
    throw AppError.badRequest('PortCode is required and must be at most 16 characters');
  }
  if (!name) throw AppError.badRequest('Name is required');
  if (!country) throw AppError.badRequest('Country is required');

  const status = (body.status ?? body.Status ?? 'OPERATIONAL').toString().toUpperCase();
  validateStatus(status);

  const lat = body.latitude ?? body.Latitude;
  const lng = body.longitude ?? body.Longitude;
  const timezone = body.timezone ?? body.Timezone;

  const latitude = lat === '' || lat == null ? null : Number(lat);
  const longitude = lng === '' || lng == null ? null : Number(lng);
  if (latitude != null && Number.isNaN(latitude)) throw AppError.badRequest('Invalid Latitude');
  if (longitude != null && Number.isNaN(longitude)) throw AppError.badRequest('Invalid Longitude');

  const tz = timezone == null || timezone === '' ? null : String(timezone).trim();

  try {
    await portRepository.insertPort({
      portCode,
      name,
      country,
      latitude,
      longitude,
      timezone: tz,
      status,
    });
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      throw AppError.conflict(`Port ${portCode} already exists`);
    }
    throw err;
  }

  return portRepository.findPortByCode(portCode);
}

async function updatePort(portCodeParam, body) {
  const portCode = normalizePortCode(portCodeParam);
  const existing = await portRepository.findPortByCode(portCode);
  if (!existing) throw AppError.notFound(`Port ${portCode} not found`);

  const name = body.name != null ? String(body.name).trim() : body.Name != null ? String(body.Name).trim() : existing.Name;
  const country =
    body.country != null ? String(body.country).trim() : body.Country != null ? String(body.Country).trim() : existing.Country;
  if (!name) throw AppError.badRequest('Name is required');
  if (!country) throw AppError.badRequest('Country is required');

  const statusRaw = body.status ?? body.Status ?? existing.Status;
  const status = String(statusRaw).toUpperCase();
  validateStatus(status);

  const lat = body.latitude !== undefined ? body.latitude : body.Latitude !== undefined ? body.Latitude : existing.Latitude;
  const lng =
    body.longitude !== undefined ? body.longitude : body.Longitude !== undefined ? body.Longitude : existing.Longitude;
  const tz = body.timezone !== undefined ? body.timezone : body.Timezone !== undefined ? body.Timezone : existing.Timezone;

  const latitude = lat === '' || lat == null ? null : Number(lat);
  const longitude = lng === '' || lng == null ? null : Number(lng);
  if (latitude != null && Number.isNaN(latitude)) throw AppError.badRequest('Invalid Latitude');
  if (longitude != null && Number.isNaN(longitude)) throw AppError.badRequest('Invalid Longitude');
  const timezone = tz == null || tz === '' ? null : String(tz).trim();

  const n = await portRepository.updatePortRow(portCode, {
    name,
    country,
    latitude,
    longitude,
    timezone,
    status,
  });
  if (!n) throw AppError.notFound(`Port ${portCode} not found`);

  return portRepository.findPortByCode(portCode);
}

async function deletePort(portCodeParam) {
  const portCode = normalizePortCode(portCodeParam);
  const existing = await portRepository.findPortByCode(portCode);
  if (!existing) throw AppError.notFound(`Port ${portCode} not found`);

  const refs = await portRepository.countPortReferences(portCode);
  if (refs > 0) {
    throw AppError.conflict(
      `Cannot delete port ${portCode}: ${refs} shipment or ownership reference(s). Set status to CLOSED instead.`,
    );
  }

  await portRepository.deletePortRow(portCode);
  return { deleted: true, portCode };
}

module.exports = {
  listPortsForUser,
  createPort,
  updatePort,
  deletePort,
};
