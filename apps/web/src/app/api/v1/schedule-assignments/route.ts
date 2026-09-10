import { GET as legacyGet, POST as legacyPost } from "../../schedule-assignments/route";
import { withApiV1 } from "@/lib/api/v1";

const policy = {
  name: "schedule-assignments",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 16_384,
};

export const GET = withApiV1(legacyGet, policy);
export const POST = withApiV1(legacyPost, policy);
