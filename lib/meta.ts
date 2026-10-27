// Meta Model API client. OpenAI-compatible: Chat Completions, Responses, Images.
// Docs: https://dev.meta.ai/docs/quickstart

import OpenAI from "openai";
import { env } from "./env";

export const META_MODELS = {
  spark: "muse-spark-1.3",
  sam: "sam-3.1",
  image: "muse-image-1.0",
} as const;

let client: OpenAI | undefined;

export function meta(): OpenAI {
  client ??= new OpenAI({
    baseURL: env("META_API_BASE_URL"),
    apiKey: env("META_API_KEY"),
    maxRetries: 3,
    timeout: 120_000,
  });
  return client;
}
