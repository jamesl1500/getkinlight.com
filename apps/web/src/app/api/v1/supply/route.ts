import {
  DELETE as legacyDelete,
  GET as legacyGet,
  PATCH as legacyPatch,
  POST as legacyPost,
} from "../../supply/route";
import { withApiV1 } from "@/lib/api/v1";

const policy = {
  name: "supply",
  maxRequests: 60,
  windowMs: 60_000,
  maxBodyBytes: 16_384,
};

export const GET = withApiV1(legacyGet, policy);
export const POST = withApiV1(legacyPost, policy);
export const PATCH = withApiV1(legacyPatch, policy);
export const DELETE = withApiV1(legacyDelete, policy);
