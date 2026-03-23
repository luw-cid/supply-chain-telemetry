const { register, login } = require('../services/auth.service');

async function registerController(req, res) {
  const data = await register(req.body);
  return res.status(201).json({
    success: true,
    data,
  });
}

async function loginController(req, res) {
  const data = await login(req.body);
  return res.status(200).json({
    success: true,
    data,
  });
}

module.exports = {
  registerController,
  loginController,
};
