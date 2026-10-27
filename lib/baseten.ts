// Baseten Model APIs client for Muse Spark Open. OpenAI-compatible Chat Completions.
// Docs: https://docs.baseten.co/inference/model-apis/overview
// Note: Muse Spark Open on Baseten does not support response_format / JSON mode,
// so structured results come back through a forced tool call instead.

import OpenAI from "openai";
import { env } from "./env";

let client: OpenAI | undefined;

export function baseten(): OpenAI {
  client ??= new OpenAI({
    baseURL: env("BASETEN_BASE_URL"),
    apiKey: env("BASETEN_API_KEY"),
    maxRetries: 2,
    timeout: 180_000,
  });
  return client;
}

export function basetenModel(): string {
  return env("BASETEN_MODEL");
}
