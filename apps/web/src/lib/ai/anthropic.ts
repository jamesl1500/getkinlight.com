import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Kinlight AI is not configured. Add ANTHROPIC_API_KEY to the web environment.",
    );
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function generateStructured<T>(
  schema: ZodType<T>,
  system: string,
  prompt: string,
) {
  const response = await client().messages.parse({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "Claude could not complete that request."
        : "Claude returned an incomplete response.",
    );
  }

  return response.parsed_output;
}

export async function extractDocument<T>(
  schema: ZodType<T>,
  system: string,
  input: {
    mediaType:
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp"
      | "application/pdf";
    base64: string;
    prompt: string;
  },
) {
  const media =
    input.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: input.mediaType,
            data: input.base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: input.mediaType,
            data: input.base64,
          },
        };
  const response = await client().messages.parse({
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system,
    messages: [
      { role: "user", content: [media, { type: "text", text: input.prompt }] },
    ],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "Claude could not process that document."
        : "Claude returned an incomplete document extraction.",
    );
  }

  return response.parsed_output;
}
