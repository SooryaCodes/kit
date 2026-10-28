// Meta Model API client. OpenAI-compatible: Chat Completions, Responses, Images.
// Docs: https://dev.meta.ai/docs/quickstart

import OpenAI from "openai";
import { config, secret } from "./env";

// Standard tier only. Contributor-tier IDs (*-contributor) let Meta train on inputs,
// which must never happen with users' photos; lib/budget.ts refuses them.
export const META_MODELS = {
  spark: "muse-spark-1.3",
  wonder: "muse-wonder-1.0",
  sam: "sam-3.1",
  image: "muse-image-1.0",
} as const;

let client: OpenAI | undefined;

export function meta(): OpenAI {
  client ??= new OpenAI({
    baseURL: config().META_API_BASE_URL,
    apiKey: secret("META_API_KEY"),
    // retries are owned by lib/budget.ts (one retry, network/5xx only)
    maxRetries: 0,
    timeout: 120_000,
  });
  return client;
}
