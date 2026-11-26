
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
  accessSecret,
  refreshSecret,
  accessExpiry,
  refreshExpiry,
} = require("../config/env");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: "access",
    },
    accessSecret,
    {
      expiresIn: accessExpiry,
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      type: "refresh",
    },
    refreshSecret,
    {
      expiresIn: refreshExpiry,
    }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, accessSecret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, refreshSecret);
};

const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

const generateTokenPair = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateTokenPair,
};
