
const authService = require("./auth.service");
const asyncHandler = require("../../utils/async-handler");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(
    req.body.refreshToken
  );

  res.status(200).json({
    success: true,
    message: "Token refreshed successfully",
    data: result,
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  res.status(200).json({
    success: true,
    message: "User retrieved successfully",
    data: { user },
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
