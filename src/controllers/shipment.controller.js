const {
  createShipment,
  getShipmentDetails,
} = require('../services/shipment.service');

async function createShipmentController(req, res) {
  const data = await createShipment(req.body);
  return res.status(201).json({
    success: true,
    data,
  });
}

async function getShipmentDetailsController(req, res) {
  const data = await getShipmentDetails(req.params.id);
  return res.status(200).json({
    success: true,
    data,
  });
}

module.exports = {
  createShipmentController,
  getShipmentDetailsController,
};
