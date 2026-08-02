import { POST as legacyPost } from "../../family/route";
import { withApiV1 } from "@/lib/api/v1";

export const POST = withApiV1(legacyPost, {
  name: "family",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 32_768,
});
