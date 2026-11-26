
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const bcrypt = require("bcrypt");

    // Set environment variables before importing application files.
    process.env.NODE_ENV = "test";
    process.env.JWT_ACCESS_SECRET = "test_access_secret_12345678901234567890";
    process.env.JWT_REFRESH_SECRET = "test_refresh_secret_12345678901234567890";
    process.env.ACCESS_TOKEN_EXPIRY = "15m";
    process.env.REFRESH_TOKEN_EXPIRY = "7d";
    process.env.BCRYPT_SALT_ROUNDS = "4";

let mongoServer;
let app;
let User;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  process.env.MONGO_URI = mongoServer.getUri();

  app = require("../src/app");
  const connectDatabase = require("../src/config/database");

  User = require("../src/modules/users/user.model");

  await connectDatabase();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Authentication API", () => {
  const validUser = {
    name: "John Doe",
    email: "john@example.com",
    password: "StrongPassword123",
  };

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(response.body.data.user.email)
        .toBe(validUser.email);

      expect(response.body.data.tokens.accessToken)
        .toBeDefined();

      expect(response.body.data.tokens.refreshToken)
        .toBeDefined();

      const user = await User.findOne({
        email: validUser.email,
      }).select("+password +refreshTokenHash");

      expect(user.password).not.toBe(validUser.password);

      expect(
        await bcrypt.compare(validUser.password, user.password)
      ).toBe(true);

      expect(user.refreshTokenHash).toBeDefined();
    });

    it("should reject duplicate email", async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      expect(response.status).toBe(409);
    });

    it("should reject invalid registration data", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "J",
          email: "invalid-email",
          password: "123",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);
    });

    it("should login with correct credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: validUser.email,
          password: validUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.tokens.accessToken)
        .toBeDefined();
    });

    it("should reject incorrect password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: validUser.email,
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Protected routes", () => {
    let accessToken;

    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      accessToken = response.body.data.tokens.accessToken;
    });

    it("should retrieve authenticated user", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email)
        .toBe(validUser.email);
    });

    it("should reject missing access token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should rotate refresh tokens", async () => {
      const registration = await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      const oldRefreshToken =
        registration.body.data.tokens.refreshToken;

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: oldRefreshToken });

      expect(response.status).toBe(200);

      const newRefreshToken =
        response.body.data.tokens.refreshToken;

      expect(newRefreshToken).not.toBe(oldRefreshToken);

      const reuseResponse = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: oldRefreshToken });

      expect(reuseResponse.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should revoke the refresh token", async () => {
      const registration = await request(app)
        .post("/api/v1/auth/register")
        .send(validUser);

      const { accessToken, refreshToken } =
        registration.body.data.tokens;

      const logoutResponse = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(logoutResponse.status).toBe(200);

      const refreshResponse = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });
});
