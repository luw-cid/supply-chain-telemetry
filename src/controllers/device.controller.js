const deviceService = require('../services/device.service');

async function listDevicesController(req, res, next) {
  try {
    const result = await deviceService.listDevices(req.query);
    return res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getDeviceController(req, res, next) {
  try {
    const device = await deviceService.getDevice(req.params.id);
    return res.status(200).json({ success: true, data: device });
  } catch (err) {
    return next(err);
  }
}

async function createDeviceController(req, res, next) {
  try {
    const device = await deviceService.createDevice(req.body);
    return res.status(201).json({ success: true, data: device });
  } catch (err) {
    return next(err);
  }
}

async function updateDeviceController(req, res, next) {
  try {
    const device = await deviceService.updateDevice(req.params.id, req.body);
    return res.status(200).json({ success: true, data: device });
  } catch (err) {
    return next(err);
  }
}

async function assignDeviceController(req, res, next) {
  try {
    const { shipmentId } = req.body;
    const result = await deviceService.assignDevice(req.params.id, shipmentId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listDevicesController,
  getDeviceController,
  createDeviceController,
  updateDeviceController,
  assignDeviceController,
};
