import { withApiV1 } from "@/lib/api/v1";
import {
  GET as legacyGet,
  PATCH as legacyPatch,
} from "../../notifications/route";

const policy = {
  name: "notifications",
  maxRequests: 120,
  windowMs: 60_000,
  maxBodyBytes: 4_096,
};

export const GET = withApiV1(legacyGet, policy);
export const PATCH = withApiV1(legacyPatch, policy);
