import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET, POST } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const profile = {
  id: "10000000-0000-4000-8000-000000000001",
  user_id: userId,
  first_name: "Pat",
  last_name: "Lee",
  username: "pat",
  avatar: null,
  role: "caregiver",
  is_admin: false,
  created_at: "2026-08-02T00:00:00.000Z",
  updated_at: null,
};

function getRequest(token = "token") {
  return new Request("http://localhost/api/onboarding", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authClient(valid = true) {
  return createSupabaseMock(
    {},
    valid
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: new Error("expired") },
  ).client;
}

const onboardingInput = {
  accessToken: "token",
  firstName: "Pat",
  lastName: "Lee",
  username: "pat",
  role: "caregiver",
};

describe("onboarding API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads a validated profile for authenticated clients", async () => {
    const profileClient = createSupabaseMock({
      profiles: { data: profile, error: null },
    });
    mocks.createClient
      .mockReturnValueOnce(authClient())
      .mockReturnValueOnce(profileClient.client);
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message: "Onboarding profile loaded.",
      profile,
    });
  });

  it("rejects missing and expired GET sessions", async () => {
    expect((await GET(getRequest(""))).status).toBe(401);
    mocks.createClient.mockReturnValue(authClient(false));
    const expired = await GET(getRequest());
    expect(expired.status).toBe(401);
  });

  it.each([
    [null, "insert"],
    [profile, "update"],
  ] as const)(
    "saves onboarding with an existing profile of %s",
    async (existing, method) => {
      const writer = createSupabaseMock({
        profiles: { data: profile, error: null },
      });
      const reader = createSupabaseMock({
        profiles: { data: existing, error: null },
      });
      mocks.createClient
        .mockReturnValueOnce(authClient())
        .mockReturnValueOnce(writer.client)
        .mockReturnValueOnce(reader.client);
      const response = await POST(postRequest(onboardingInput));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, profile });
      expect(writer.calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "profiles", method }),
        ]),
      );
    },
  );

  it("rejects malformed and expired POST requests", async () => {
    expect((await POST(postRequest({ accessToken: "token" }))).status).toBe(
      400,
    );
    mocks.createClient.mockReturnValue(authClient(false));
    const expired = await POST(postRequest(onboardingInput));
    expect(expired.status).toBe(401);
  });

  it("reports profile write and response-shape failures", async () => {
    const failedWriter = createSupabaseMock({
      profiles: { data: null, error: { message: "Username already exists" } },
    });
    const reader = createSupabaseMock({
      profiles: { data: null, error: null },
    });
    mocks.createClient
      .mockReturnValueOnce(authClient())
      .mockReturnValueOnce(failedWriter.client)
      .mockReturnValueOnce(reader.client);
    const conflict = await POST(postRequest(onboardingInput));
    expect(conflict.status).toBe(400);
    expect(await conflict.json()).toMatchObject({
      message: "Username already exists",
    });

    const invalidWriter = createSupabaseMock({
      profiles: { data: { id: "invalid" }, error: null },
    });
    mocks.createClient
      .mockReturnValueOnce(authClient())
      .mockReturnValueOnce(invalidWriter.client)
      .mockReturnValueOnce(reader.client);
    const invalid = await POST(postRequest(onboardingInput));
    expect(invalid.status).toBe(500);
    expect(await invalid.json()).toMatchObject({
      message: expect.stringContaining("response format"),
    });
  });
});
