const express = require('express');
const {
  listDevicesController,
  getDeviceController,
  createDeviceController,
  updateDeviceController,
  assignDeviceController,
} = require('../controllers/device.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listDevicesController);
router.get('/:id', authenticate, getDeviceController);
router.post('/', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), createDeviceController);
router.patch('/:id', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), updateDeviceController);
router.post('/:id/assign', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), assignDeviceController);

module.exports = router;
