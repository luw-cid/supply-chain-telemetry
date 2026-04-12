const {
  createShipment,
  getShipmentDetails,
  listShipments,
} = require('../services/shipment.service');

async function listShipmentsController(req, res, next) {
  try {
    const result = await listShipments(req.query, {
      role: req.user?.role,
      partyId: req.user?.partyId ?? null,
    });
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

async function createShipmentController(req, res, next) {
  try {
    const data = await createShipment(req.body);
    return res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getShipmentDetailsController(req, res, next) {
  try {
    const data = await getShipmentDetails(req.params.id, {
      role: req.user?.role,
      partyId: req.user?.partyId ?? null,
    });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listShipmentsController,
  createShipmentController,
  getShipmentDetailsController,
};
