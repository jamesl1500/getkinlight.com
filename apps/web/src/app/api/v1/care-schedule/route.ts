import {
  PATCH as legacyPatch,
  POST as legacyPost,
} from "../../care-schedule/route";
import { withApiV1 } from "@/lib/api/v1";

const policy = {
  name: "care-schedule",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 65_536,
};

export const POST = withApiV1(legacyPost, policy);
export const PATCH = withApiV1(legacyPatch, policy);
