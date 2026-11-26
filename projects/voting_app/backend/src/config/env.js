require("dotenv").config();
console.log("Environment file loaded:", !!process.env.MONGO_URI);
module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,

  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,

  accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",

  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
};