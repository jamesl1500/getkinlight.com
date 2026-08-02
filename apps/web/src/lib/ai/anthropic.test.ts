import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  format: vi.fn(() => ({ type: "json_schema" })),
  constructor: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = { parse: mocks.parse };

    constructor(options: unknown) {
      mocks.constructor(options);
    }
  },
}));
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: mocks.format,
}));

import { extractDocument, generateStructured } from "./anthropic";

describe("Anthropic AI adapter", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.ANTHROPIC_MODEL;
    mocks.parse.mockReset();
    mocks.format.mockClear();
    mocks.constructor.mockClear();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  it("requires an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      generateStructured(z.object({ answer: z.string() }), "system", "prompt"),
    ).rejects.toThrow("Kinlight AI is not configured");
  });

  it("returns parsed structured output with the configured model", async () => {
    process.env.ANTHROPIC_MODEL = "claude-test";
    mocks.parse.mockResolvedValue({
      parsed_output: { answer: "Ready" },
      stop_reason: "end_turn",
    });

    await expect(
      generateStructured(z.object({ answer: z.string() }), "safe", "question"),
    ).resolves.toEqual({
      answer: "Ready",
    });
    expect(mocks.constructor).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test", system: "safe" }),
    );
  });

  it.each([
    ["refusal", "Claude could not complete that request."],
    ["max_tokens", "Claude returned an incomplete response."],
  ])("maps %s structured failures", async (stopReason, message) => {
    mocks.parse.mockResolvedValue({
      parsed_output: null,
      stop_reason: stopReason,
    });
    await expect(
      generateStructured(z.object({}), "system", "prompt"),
    ).rejects.toThrow(message);
  });

  it.each([
    ["application/pdf" as const, "document"],
    ["image/png" as const, "image"],
  ])("builds %s document content", async (mediaType, expectedType) => {
    mocks.parse.mockResolvedValue({
      parsed_output: { summary: "Done" },
      stop_reason: "end_turn",
    });
    await extractDocument(z.object({ summary: z.string() }), "system", {
      mediaType,
      base64: "ZmlsZQ==",
      prompt: "Extract",
    });
    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        messages: [
          {
            role: "user",
            content: [
              expect.objectContaining({ type: expectedType }),
              { type: "text", text: "Extract" },
            ],
          },
        ],
      }),
    );
  });

  it.each([
    ["refusal", "Claude could not process that document."],
    ["max_tokens", "Claude returned an incomplete document extraction."],
  ])("maps %s document failures", async (stopReason, message) => {
    mocks.parse.mockResolvedValue({
      parsed_output: null,
      stop_reason: stopReason,
    });
    await expect(
      extractDocument(z.object({}), "system", {
        mediaType: "image/jpeg",
        base64: "x",
        prompt: "Extract",
      }),
    ).rejects.toThrow(message);
  });
});
