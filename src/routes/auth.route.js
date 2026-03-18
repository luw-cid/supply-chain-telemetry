const express = require('express');
const { registerController, loginController } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', registerController);
router.post('/login', loginController);

router.get('/me', authenticate, (req, res) => {
	res.status(200).json({
		success: true,
		data: req.user,
	});
});

module.exports = router;