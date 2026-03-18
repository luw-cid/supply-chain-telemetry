const { register, login } = require('../services/auth.service');

async function registerController(req, res) {
  try {
    const data = await register(req.body);
    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      error: error.message || 'Bad request',
    });
  }
}

async function loginController(req, res) {
  try {
    const data = await login(req.body);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      success: false,
      error: error.message || 'Unauthorized',
    });
  }
}

module.exports = {
  registerController,
  loginController,
};
