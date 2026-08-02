import {
  KinlightApiErrorCodeSchema,
  type KinlightApiErrorCode,
} from "@getkinlight.com/shared";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RouteHandler = (request: Request) => Promise<Response>;

type ApiPolicy = {
  name: string;
  maxRequests: number;
  windowMs: number;
  maxBodyBytes: number;
};

type RateWindow = { count: number; resetsAt: number };
type RateResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetsAt: number;
};

const rateWindows = new Map<string, RateWindow>();
const distributedLimiters = new Map<string, Ratelimit>();

function clientAddress(request: Request) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[a-zA-Z0-9_-]{8,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

function errorCode(status: number): KinlightApiErrorCode {
  const code =
    status === 401
      ? "AUTH_REQUIRED"
      : status === 403
        ? "FORBIDDEN"
        : status === 409
          ? "CONFLICT"
          : status === 413
            ? "PAYLOAD_TOO_LARGE"
            : status === 429
              ? "RATE_LIMITED"
              : status === 503
                ? "SERVICE_UNAVAILABLE"
                : status >= 500
                  ? "INTERNAL_ERROR"
                  : "VALIDATION_ERROR";
  return KinlightApiErrorCodeSchema.parse(code);
}

function localRateLimit(request: Request, policy: ApiPolicy): RateResult {
  const now = Date.now();
  if (rateWindows.size > 10_000) {
    for (const [key, value] of rateWindows) {
      if (value.resetsAt <= now) rateWindows.delete(key);
    }
  }
  const key = `${policy.name}:${clientAddress(request)}`;
  const current = rateWindows.get(key);
  const window =
    !current || current.resetsAt <= now
      ? { count: 1, resetsAt: now + policy.windowMs }
      : { count: current.count + 1, resetsAt: current.resetsAt };
  rateWindows.set(key, window);
  return {
    allowed: window.count <= policy.maxRequests,
    limit: policy.maxRequests,
    remaining: Math.max(0, policy.maxRequests - window.count),
    resetsAt: window.resetsAt,
  };
}

function distributedLimiter(policy: ApiPolicy) {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  const existing = distributedLimiters.get(policy.name);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(
      policy.maxRequests,
      `${policy.windowMs} ms`,
    ),
    prefix: `kinlight:api:${policy.name}`,
  });
  distributedLimiters.set(policy.name, limiter);
  return limiter;
}

async function rateLimit(
  request: Request,
  policy: ApiPolicy,
): Promise<RateResult> {
  const limiter = distributedLimiter(policy);
  if (limiter) {
    try {
      const result = await limiter.limit(clientAddress(request));
      return {
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetsAt: result.reset,
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          type: "api.rate_limit.error",
          route: policy.name,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }
  return localRateLimit(request, policy);
}

async function bodyTooLarge(request: Request, maxBodyBytes: number) {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes)
    return true;
  if (request.body === null) return false;
  return (await request.clone().arrayBuffer()).byteLength > maxBodyBytes;
}

function headersFor(response: Response, id: string, rate: RateResult) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-API-Version", "v1");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Request-ID", id);
  headers.set("X-RateLimit-Limit", String(rate.limit));
  headers.set("X-RateLimit-Remaining", String(rate.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(rate.resetsAt / 1000)));
  return headers;
}

function errorResponse(
  status: number,
  message: string,
  id: string,
  rate: RateResult,
) {
  return new Response(
    JSON.stringify({
      ok: false,
      message,
      code: errorCode(status),
      requestId: id,
    }),
    {
      status,
      headers: headersFor(
        new Response(null, {
          headers: { "Content-Type": "application/json" },
        }),
        id,
        rate,
      ),
    },
  );
}

export function withApiV1(
  handler: RouteHandler,
  policy: ApiPolicy,
): RouteHandler {
  return async (request) => {
    const id = requestId(request);
    const startedAt = performance.now();
    const rate = await rateLimit(request, policy);
    let response: Response;

    try {
      if (!rate.allowed) {
        response = errorResponse(
          429,
          "Too many requests. Try again shortly.",
          id,
          rate,
        );
      } else if (await bodyTooLarge(request, policy.maxBodyBytes)) {
        response = errorResponse(413, "This request is too large.", id, rate);
      } else {
        const result = await handler(request);
        if (result.ok) {
          response = new Response(result.body, {
            status: result.status,
            statusText: result.statusText,
            headers: headersFor(result, id, rate),
          });
        } else {
          const payload = (await result
            .clone()
            .json()
            .catch(() => null)) as {
            message?: unknown;
          } | null;
          response = errorResponse(
            result.status,
            typeof payload?.message === "string"
              ? payload.message
              : "Kinlight could not complete that request.",
            id,
            rate,
          );
        }
      }
    } catch {
      response = errorResponse(
        500,
        "Something went wrong. Please try again.",
        id,
        rate,
      );
    }

    const log = {
      type: "api.request",
      requestId: id,
      apiVersion: "v1",
      route: policy.name,
      method: request.method,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    };
    if (response.status >= 500) console.error(JSON.stringify(log));
    else if (response.status >= 400) console.warn(JSON.stringify(log));
    else console.info(JSON.stringify(log));
    return response;
  };
}
