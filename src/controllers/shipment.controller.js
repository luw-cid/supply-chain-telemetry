const {
  createShipment,
  getShipmentDetails,
} = require('../services/shipment.service');

async function createShipmentController(req, res, next) {
  try {
    const data = await createShipment(req.body);
    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getShipmentDetailsController(req, res, next) {
  try {
    const data = await getShipmentDetails(req.params.id);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createShipmentController,
  getShipmentDetailsController,
};
