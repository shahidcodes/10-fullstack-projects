
const AppError = require("../utils/app-error");

const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new AppError("Validation failed", 400)
      );
    }

    req.body = result.data;
    next();
  };
};

module.exports = validate;
