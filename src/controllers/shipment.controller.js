const {
  createShipment,
  getShipmentDetails,
} = require('../services/shipment.service');

async function createShipmentController(req, res) {
  try {
    const data = await createShipment(req.body);
    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

async function getShipmentDetailsController(req, res) {
  try {
    const data = await getShipmentDetails(req.params.id);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

module.exports = {
  createShipmentController,
  getShipmentDetailsController,
};
