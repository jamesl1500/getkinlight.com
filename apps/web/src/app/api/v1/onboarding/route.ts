import { GET as legacyGet, POST as legacyPost } from "../../onboarding/route";
import { withApiV1 } from "@/lib/api/v1";

const policy = {
  name: "onboarding",
  maxRequests: 30,
  windowMs: 60_000,
  maxBodyBytes: 32_768,
};

export const GET = withApiV1(legacyGet, policy);
export const POST = withApiV1(legacyPost, policy);
