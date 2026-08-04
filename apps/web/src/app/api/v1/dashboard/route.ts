import { GET as legacyGet } from "../../dashboard/route";
import { withApiV1 } from "@/lib/api/v1";

export const GET = withApiV1(legacyGet, {
  name: "dashboard",
  maxRequests: 120,
  windowMs: 60_000,
  maxBodyBytes: 1_024,
});
