import { PATCH as legacyPatch } from "../../account/route";
import { withApiV1 } from "@/lib/api/v1";

export const PATCH = withApiV1(legacyPatch, {
  name: "account-deletion",
  maxRequests: 5,
  windowMs: 60_000,
  maxBodyBytes: 1_024,
});
