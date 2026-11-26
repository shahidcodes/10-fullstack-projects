const { z } = require("zod");

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(60, "Name cannot exceed 60 characters"),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
}).strict();

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),

  password: z.string().min(1, "Password is required"),
}).strict();

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
}).strict();

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
