const express = require('express');
const {
  createShipmentController,
  getShipmentDetailsController,
} = require('../controllers/shipment.controller');

const router = express.Router();

router.post('/', createShipmentController);
router.get('/:id', getShipmentDetailsController);

module.exports = router;
