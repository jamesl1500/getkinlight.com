import { z } from "zod";
import { ProfileSchema } from "./profile";

export const OnboardingRoleSchema = z.enum([
  "family-organizer",
  "parent",
  "caregiver",
  "relative",
]);

export type OnboardingRole = z.infer<typeof OnboardingRoleSchema>;

const nameSchema = z.string().trim().min(1).max(60);
const usernameSchema = z.string().trim().min(3).max(30).regex(/^[a-z0-9_-]+$/i, {
  message: "Username can use letters, numbers, underscores, and hyphens.",
});

export const OnboardingRequestSchema = z.object({
  accessToken: z.string().min(1),
  firstName: nameSchema,
  lastName: nameSchema,
  username: usernameSchema,
  role: OnboardingRoleSchema,
});

export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;

export const OnboardingResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  profile: ProfileSchema.nullish(),
});

export type OnboardingResponse = z.infer<typeof OnboardingResponseSchema>;