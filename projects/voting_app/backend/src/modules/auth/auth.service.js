
const bcrypt = require("bcrypt");

const User = require("../users/user.model");
const AppError = require("../../utils/app-error");

const {
  generateTokenPair,
  verifyRefreshToken,
  hashToken,
} = require("../../utils/token.utils");

const { bcryptRounds } = require("../../config/env");

const createUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
});

const register = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(
    password,
    bcryptRounds
  );

  let user;

  try {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
  } catch (error) {
    // Handle concurrent registrations for the same email.
    if (error.code === 11000) {
      throw new AppError("Email is already registered", 409);
    }

    throw error;
  }

  const tokens = generateTokenPair(user);

  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();

  return {
    user: createUserResponse(user),
    tokens,
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email })
    .select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive", 403);
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokens = generateTokenPair(user);

  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();

  return {
    user: createUserResponse(user),
    tokens,
  };
};

const refresh = async (refreshToken) => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh") {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(payload.sub)
    .select("+refreshTokenHash");

  if (!user || !user.isActive) {
    throw new AppError("Invalid refresh token", 401);
  }

  const incomingHash = hashToken(refreshToken);

  if (user.refreshTokenHash !== incomingHash) {
    throw new AppError("Refresh token has already been used or revoked", 401);
  }

  const tokens = generateTokenPair(user);
  const newHash = hashToken(tokens.refreshToken);

  // Atomic compare-and-swap prevents two simultaneous refresh
  // requests from both successfully rotating the same token.
  const result = await User.updateOne(
    {
      _id: user._id,
      refreshTokenHash: incomingHash,
    },
    {
      $set: {
        refreshTokenHash: newHash,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new AppError("Refresh token is no longer valid", 401);
  }

  return {
    user: createUserResponse(user),
    tokens,
  };
};

const logout = async (userId) => {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        refreshTokenHash: null,
      },
    }
  );

  return true;
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }

  return createUserResponse(user);
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};
