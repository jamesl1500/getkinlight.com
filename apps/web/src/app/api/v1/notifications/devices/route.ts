import { PATCH as legacyPatch } from "../../../notifications/devices/route";
import { withApiV1 } from "@/lib/api/v1";

export const PATCH = withApiV1(legacyPatch, {
  name: "notification-devices",
  maxRequests: 30,
  windowMs: 60_000,
  maxBodyBytes: 8_192,
});
