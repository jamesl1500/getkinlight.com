import { z } from "zod";
import { ProfileSchema } from "./profile";

export const AuthModeSchema = z.enum([
  "sign-in",
  "sign-up",
  "forgot-password",
  "update-password",
]);

export type AuthMode = z.infer<typeof AuthModeSchema>;

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8);

export const SignInAuthRequestSchema = z.object({
  mode: z.literal("sign-in"),
  email: emailSchema,
  password: passwordSchema,
});

export const SignUpAuthRequestSchema = z.object({
  mode: z.literal("sign-up"),
  email: emailSchema,
  password: passwordSchema,
  redirectTo: z.string().max(2048).optional(),
});

export const ForgotPasswordAuthRequestSchema = z.object({
  mode: z.literal("forgot-password"),
  email: emailSchema,
});

export const UpdatePasswordAuthRequestSchema = z.object({
  mode: z.literal("update-password"),
  password: passwordSchema,
  accessToken: z.string().min(1),
});

export const AuthRequestSchema = z.discriminatedUnion("mode", [
  SignInAuthRequestSchema,
  SignUpAuthRequestSchema,
  ForgotPasswordAuthRequestSchema,
  UpdatePasswordAuthRequestSchema,
]);

export type AuthRequest = z.infer<typeof AuthRequestSchema>;

export const AuthSessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

export const AuthResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  session: AuthSessionSchema.nullish(),
  profile: ProfileSchema.nullish(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const DeleteAccountRequestSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export const DeleteAccountResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;
