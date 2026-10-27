// Baseten Model APIs client for Muse Spark Open. OpenAI-compatible Chat Completions.
// Docs: https://docs.baseten.co/inference/model-apis/overview
// Note: Muse Spark Open on Baseten does not support response_format / JSON mode,
// so structured results come back through a forced tool call instead.

import OpenAI from "openai";
import { config, secret } from "./env";

let client: OpenAI | undefined;

export function baseten(): OpenAI {
  client ??= new OpenAI({
    baseURL: config().BASETEN_BASE_URL,
    apiKey: secret("BASETEN_API_KEY"),
    maxRetries: 0,
    timeout: 180_000,
  });
  return client;
}

export function basetenModel(): string {
  return config().BASETEN_MODEL;
}
