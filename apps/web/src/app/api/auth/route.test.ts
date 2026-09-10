import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { POST } from "./route";

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
const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "bearer",
};

function request(body: unknown) {
  return new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed authentication requests", async () => {
    const response = await POST(
      request({ mode: "sign-in", email: "not-an-email" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Invalid authentication request.",
      session: null,
      profile: null,
    });
  });

  it("signs in and returns the shared session and profile contract", async () => {
    const profileClient = createSupabaseMock({
      profiles: { data: profile, error: null },
    });
    const signInWithPassword = vi.fn(async () => ({
      data: { session, user: { id: userId } },
      error: null,
    }));
    mocks.createClient.mockImplementation((token?: string) =>
      token ? profileClient.client : { auth: { signInWithPassword } },
    );
    const response = await POST(
      request({
        mode: "sign-in",
        email: "pat@example.com",
        password: "password123",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, session, profile });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "pat@example.com",
      password: "password123",
    });
  });

  it("sanitizes sign-up redirects and returns confirmation state", async () => {
    const signUp = vi.fn(async () => ({
      data: { session: null, user: { id: userId } },
      error: null,
    }));
    mocks.createClient.mockReturnValue({ auth: { signUp } });
    const response = await POST(
      request({
        mode: "sign-up",
        email: "new@example.com",
        password: "password123",
        redirectTo: "https://evil.example/steal",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      session: null,
      profile: null,
    });
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo: "http://localhost/auth/confirm?next=%2Fdashboard",
        },
      }),
    );
  });

  it("sends password reset emails to the fixed callback", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    mocks.createClient.mockReturnValue({ auth: { resetPasswordForEmail } });
    const response = await POST(
      request({ mode: "forgot-password", email: "pat@example.com" }),
    );
    expect(response.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("pat@example.com", {
      redirectTo: "http://localhost/auth/update-password",
    });
  });

  it("updates a password and returns the latest profile", async () => {
    const profileClient = createSupabaseMock({
      profiles: { data: profile, error: null },
    });
    const updateUser = vi.fn(async () => ({
      data: { user: { id: userId } },
      error: null,
    }));
    const tokenClient = {
      ...profileClient.client,
      auth: { ...profileClient.client.auth, updateUser },
    };
    mocks.createClient.mockReturnValue(tokenClient);
    const response = await POST(
      request({
        mode: "update-password",
        accessToken: "access-token",
        password: "newpassword123",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      session: null,
      profile,
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "newpassword123" });
  });

  it("maps provider errors and unexpected failures to stable responses", async () => {
    mocks.createClient.mockReturnValueOnce({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid credentials" },
        })),
      },
    });
    const provider = await POST(
      request({
        mode: "sign-in",
        email: "pat@example.com",
        password: "password123",
      }),
    );
    expect(provider.status).toBe(400);
    expect(await provider.json()).toMatchObject({
      message: "Invalid credentials",
    });

    mocks.createClient.mockImplementationOnce(() => {
      throw new Error("network");
    });
    const unexpected = await POST(
      request({ mode: "forgot-password", email: "pat@example.com" }),
    );
    expect(unexpected.status).toBe(500);
    expect(await unexpected.json()).toMatchObject({
      message: "Something went wrong. Please try again.",
    });
  });

  it("signs in without a session and skips the profile lookup", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: null,
        })),
      },
    });
    const response = await POST(
      request({
        mode: "sign-in",
        email: "pat@example.com",
        password: "password123",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      session: null,
      profile: null,
    });
  });

  it("returns a stable error when sign-up fails", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        signUp: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Email already registered" },
        })),
      },
    });
    const response = await POST(
      request({
        mode: "sign-up",
        email: "pat@example.com",
        password: "password123",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Email already registered",
    });
  });

  it("returns a stable error when the password reset email fails", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        resetPasswordForEmail: vi.fn(async () => ({
          error: { message: "Unable to send email" },
        })),
      },
    });
    const response = await POST(
      request({ mode: "forgot-password", email: "pat@example.com" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Unable to send email",
    });
  });

  it("returns a stable error when updating the password fails", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        updateUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: "Session expired" },
        })),
      },
    });
    const response = await POST(
      request({
        mode: "update-password",
        accessToken: "access-token",
        password: "newpassword123",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Session expired",
    });
  });

  it("skips the profile lookup when the updated user has no id", async () => {
    mocks.createClient.mockReturnValue({
      auth: {
        updateUser: vi.fn(async () => ({
          data: { user: null },
          error: null,
        })),
      },
    });
    const response = await POST(
      request({
        mode: "update-password",
        accessToken: "access-token",
        password: "newpassword123",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, profile: null });
  });
});
