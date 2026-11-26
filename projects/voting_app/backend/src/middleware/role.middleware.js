
const AppError = require('../utils/app-error');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

module.exports = authorize;
