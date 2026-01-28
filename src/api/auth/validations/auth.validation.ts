import {
  email,
  maxLength,
  minLength,
  object,
  optional,
  pipe,
  regex,
  string,
  type InferOutput,
} from "valibot";

// Registration validation schema
export const registerSchema = object({
  email: pipe(
    string(),
    minLength(1, "Email is required"),
    email("Invalid email format"),
  ),
  password: pipe(
    string(),
    minLength(8, "Password must be at least 8 characters"),
    maxLength(100, "Password must not exceed 100 characters"),
    regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  ),
  username: pipe(
    string(),
    minLength(3, "Username must be at least 3 characters"),
    maxLength(50, "Username must not exceed 50 characters"),
    regex(/^\w+$/, "Username can only contain letters, numbers, and underscores"),
  ),
  firstName: optional(pipe(
    string(),
    minLength(1, "First name cannot be empty"),
    maxLength(100, "First name must not exceed 100 characters"),
  )),
  lastName: optional(pipe(
    string(),
    minLength(1, "Last name cannot be empty"),
    maxLength(100, "Last name must not exceed 100 characters"),
  )),
  phone: optional(pipe(
    string(),
    regex(/^\+?[\d\s-]+$/, "Invalid phone number format"),
  )),
});

// Login validation schema
export const loginSchema = object({
  email: pipe(
    string(),
    minLength(1, "Email is required"),
    email("Invalid email format"),
  ),
  password: pipe(
    string(),
    minLength(1, "Password is required"),
  ),
});

// Refresh token validation schema
export const refreshTokenSchema = object({
  refreshToken: pipe(
    string(),
    minLength(1, "Refresh token is required"),
  ),
});

// Forgot password validation schema
export const forgotPasswordSchema = object({
  email: pipe(
    string(),
    minLength(1, "Email is required"),
    email("Invalid email format"),
  ),
});

// Reset password validation schema
export const resetPasswordSchema = object({
  token: pipe(
    string(),
    minLength(1, "Reset token is required"),
  ),
  password: pipe(
    string(),
    minLength(8, "Password must be at least 8 characters"),
    maxLength(100, "Password must not exceed 100 characters"),
    regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  ),
});

// Change password validation schema
export const changePasswordSchema = object({
  currentPassword: pipe(
    string(),
    minLength(1, "Current password is required"),
  ),
  newPassword: pipe(
    string(),
    minLength(8, "Password must be at least 8 characters"),
    maxLength(100, "Password must not exceed 100 characters"),
    regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  ),
});

// Type inference
export type RegisterInput = InferOutput<typeof registerSchema>;
export type LoginInput = InferOutput<typeof loginSchema>;
export type RefreshTokenInput = InferOutput<typeof refreshTokenSchema>;
export type ForgotPasswordInput = InferOutput<typeof forgotPasswordSchema>;
export type ResetPasswordInput = InferOutput<typeof resetPasswordSchema>;
export type ChangePasswordInput = InferOutput<typeof changePasswordSchema>;
