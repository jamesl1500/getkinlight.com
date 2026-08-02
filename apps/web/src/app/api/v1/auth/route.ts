import { POST as legacyPost } from "../../auth/route";
import { withApiV1 } from "@/lib/api/v1";

export const POST = withApiV1(legacyPost, {
  name: "auth",
  maxRequests: 10,
  windowMs: 60_000,
  maxBodyBytes: 16_384,
});
