import { GET as legacyGet } from "../../tasks/route";
import { withApiV1 } from "@/lib/api/v1";

const policy = {
  name: "tasks",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 16_384,
};

export const GET = withApiV1(legacyGet, policy);
