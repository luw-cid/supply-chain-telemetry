const deviceRepository = require('../repositories/device.repository');
const AppError = require('../utils/app-error');

async function listDevices(query = {}) {
  return deviceRepository.listDevices({
    status: query.status,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

async function getDevice(deviceId) {
  if (!deviceId) {
    throw AppError.badRequest('DeviceID is required');
  }
  const device = await deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw AppError.notFound(`Device ${deviceId} not found`);
  }
  return device;
}

async function createDevice(payload) {
  const { DeviceID, DeviceName, DeviceType, FirmwareVer } = payload;

  if (!DeviceID) {
    throw AppError.badRequest('DeviceID is required');
  }

  const existing = await deviceRepository.findDeviceById(DeviceID);
  if (existing) {
    throw AppError.badRequest(`DeviceID ${DeviceID} already exists`);
  }

  await deviceRepository.insertDevice({
    DeviceID,
    DeviceName: DeviceName || null,
    DeviceType: DeviceType || 'IOT_SENSOR',
    FirmwareVer: FirmwareVer || null,
  });

  return { DeviceID, DeviceName, DeviceType, Status: 'ACTIVE' };
}

async function updateDevice(deviceId, payload) {
  if (!deviceId) {
    throw AppError.badRequest('DeviceID is required');
  }

  const existing = await deviceRepository.findDeviceById(deviceId);
  if (!existing) {
    throw AppError.notFound(`Device ${deviceId} not found`);
  }

  await deviceRepository.updateDevice(deviceId, {
    DeviceName: payload.DeviceName,
    DeviceType: payload.DeviceType,
    Status: payload.Status,
    FirmwareVer: payload.FirmwareVer,
    Metadata: payload.Metadata,
  });

  return { DeviceID: deviceId, ...payload };
}

async function assignDevice(deviceId, shipmentId) {
  if (!deviceId) {
    throw AppError.badRequest('DeviceID is required');
  }

  const device = await deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw AppError.notFound(`Device ${deviceId} not found`);
  }

  await deviceRepository.assignDeviceToShipment(deviceId, shipmentId || null);

  return { DeviceID: deviceId, AssignedShipmentID: shipmentId || null };
}

module.exports = {
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  assignDevice,
};
