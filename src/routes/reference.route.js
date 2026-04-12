const express = require('express');
const {
  listPortsController,
  createPortController,
  updatePortController,
  deletePortController,
  listPartiesController,
  createPartyController,
  updatePartyController,
  listCargoProfilesController,
} = require('../controllers/reference.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/ports', listPortsController);
router.post('/ports', authorizeRoles('ADMIN'), createPortController);
router.put('/ports/:portCode', authorizeRoles('ADMIN'), updatePortController);
router.delete('/ports/:portCode', authorizeRoles('ADMIN'), deletePortController);

router.get('/parties', listPartiesController);
router.post('/parties', authorizeRoles('ADMIN', 'LOGISTICS'), createPartyController);
router.put('/parties/:partyId', authorizeRoles('ADMIN', 'LOGISTICS'), updatePartyController);
router.get('/cargo-profiles', listCargoProfilesController);

module.exports = router;
