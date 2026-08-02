import { POST as legacyPost } from "../../care/route";
import { withApiV1 } from "@/lib/api/v1";

export const POST = withApiV1(legacyPost, {
  name: "care",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 65_536,
});
