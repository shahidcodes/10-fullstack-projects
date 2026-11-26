
const {
  verifyAccessToken,
} = require("../utils/token.utils");

const AppError = require("../utils/app-error");

const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(
      new AppError("Authentication required", 401)
    );
  }

  const token = authorization.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== "access") {
      throw new Error("Invalid token type");
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(
      new AppError("Invalid or expired access token", 401)
    );
  }
};

module.exports = authenticate;
