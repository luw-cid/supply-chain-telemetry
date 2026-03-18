const { register, login } = require('../services/auth.service');

async function registerController(req, res, next) {
  try {
    const data = await register(req.body);
    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function loginController(req, res, next) {
  try {
    const data = await login(req.body);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerController,
  loginController,
};
