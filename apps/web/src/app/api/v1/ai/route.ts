import { POST as legacyPost } from "../../ai/route";
import { withApiV1 } from "@/lib/api/v1";

export const runtime = "nodejs";

export const POST = withApiV1(legacyPost, {
  name: "ai",
  maxRequests: 20,
  windowMs: 60_000,
  maxBodyBytes: 15_000_000,
});
