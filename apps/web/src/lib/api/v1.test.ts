import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  distributedLimit: vi.fn(),
  redisFromEnv: vi.fn(() => ({})),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: mocks.redisFromEnv },
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }

    limit = mocks.distributedLimit;
  },
}));

import { withApiV1 } from "./v1";

function policy(name: string, maxRequests = 2, maxBodyBytes = 100) {
  return { name, maxRequests, maxBodyBytes, windowMs: 60_000 };
}

describe("API v1 wrapper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.distributedLimit.mockReset();
  });

  it("adds version, correlation, cache, and rate headers", async () => {
    const handler = vi.fn(async () =>
      Response.json({ ok: true, message: "done" }),
    );
    const response = await withApiV1(
      handler,
      policy("success"),
    )(
      new Request("http://localhost/api/v1/care", {
        headers: { "x-request-id": "request_123" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-api-version")).toBe("v1");
    expect(response.headers.get("x-request-id")).toBe("request_123");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("1");
  });

  it("normalizes legacy errors into stable v1 envelopes", async () => {
    const response = await withApiV1(
      async () =>
        Response.json({ ok: false, message: "Denied" }, { status: 403 }),
      policy("forbidden"),
    )(new Request("http://localhost/api/v1/family"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "Denied",
      code: "FORBIDDEN",
      requestId: expect.any(String),
    });
  });

  it("rejects oversized request bodies before route execution", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await withApiV1(
      handler,
      policy("payload", 2, 5),
    )(
      new Request("http://localhost/api/v1/care", {
        method: "POST",
        body: "too-large",
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies using the content-length header", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await withApiV1(
      handler,
      policy("payload-header", 2, 5),
    )(
      new Request("http://localhost/api/v1/care", {
        method: "POST",
        headers: { "content-length": "1000" },
        body: "too-large",
      }),
    );
    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the route response body is not JSON", async () => {
    const response = await withApiV1(
      async () => new Response("not json", { status: 400 }),
      policy("bad-json"),
    )(new Request("http://localhost/api/v1/care"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Kinlight could not complete that request.",
    });
  });

  it("delegates bodyless writes to route validation", async () => {
    const handler = vi.fn(async () =>
      Response.json({ ok: false, message: "Invalid request" }, { status: 400 }),
    );
    const response = await withApiV1(
      handler,
      policy("empty-write"),
    )(new Request("http://localhost/api/v1/care", { method: "POST" }));

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
    });
  });

  it("rate limits by route and client address", async () => {
    const wrapped = withApiV1(
      async () => Response.json({ ok: true }),
      policy("limited", 1),
    );
    const first = await wrapped(
      new Request("http://localhost/api/v1/care", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    const second = await wrapped(
      new Request("http://localhost/api/v1/care", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("uses distributed rate limits when Upstash is configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    mocks.distributedLimit.mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 17,
      reset: 123_000,
    });
    const response = await withApiV1(
      async () => Response.json({ ok: true }),
      policy("distributed", 20),
    )(
      new Request("http://localhost/api/v1/care", {
        headers: { "x-real-ip": "203.0.113.20" },
      }),
    );
    await withApiV1(
      async () => Response.json({ ok: true }),
      policy("distributed", 20),
    )(
      new Request("http://localhost/api/v1/care", {
        headers: { "x-real-ip": "203.0.113.20" },
      }),
    );

    expect(mocks.distributedLimit).toHaveBeenCalledTimes(2);
    expect(mocks.redisFromEnv).toHaveBeenCalledOnce();
    expect(response.headers.get("x-ratelimit-limit")).toBe("20");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("17");
  });

  it("uses local limits when Upstash configuration is incomplete", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    const response = await withApiV1(
      async () => Response.json({ ok: true }),
      policy("partial-config", 3),
    )(new Request("http://localhost/api/v1/care"));

    expect(mocks.distributedLimit).not.toHaveBeenCalled();
    expect(response.headers.get("x-ratelimit-remaining")).toBe("2");
  });

  it("falls back to local limits when the distributed provider fails", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    mocks.distributedLimit.mockRejectedValue(new Error("provider unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await withApiV1(
      async () => Response.json({ ok: true }),
      policy("provider-failure", 2),
    )(new Request("http://localhost/api/v1/care"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("1");
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("api.rate_limit.error"),
    );
    consoleError.mockRestore();
  });

  it("converts unhandled route failures into safe internal errors", async () => {
    const response = await withApiV1(async () => {
      throw new Error("secret database detail");
    }, policy("failure"))(new Request("http://localhost/api/v1/care"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    });
  });
});
