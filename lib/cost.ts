// Per-call cost accounting in USD. Prices from each provider's published pricing:
//   Meta Model API  https://dev.meta.ai/docs/pricing-rate-limits
//   Baseten         https://www.baseten.co/library/muse-spark-open
//   fal             https://fal.ai/models/fal-ai/sam-3/3d-objects ($0.02 per call)

export const PRICES = {
  // per 1M tokens
  "muse-spark-1.3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-open": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  // per unit
  "sam-3.1-image": 2.5 / 1000,
  "muse-image-1.0": 0.01,
  "fal-sam-3d-objects": 0.02,
} as const;

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
}

export function tokenCost(model: "muse-spark-1.3" | "muse-spark-open", usage: TokenUsage | undefined): number {
  if (!usage) return 0;
  const p = PRICES[model];
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const freshInput = (usage.prompt_tokens ?? 0) - cachedTokens;
  return (freshInput * p.input + cachedTokens * p.cachedInput + (usage.completion_tokens ?? 0) * p.output) / 1_000_000;
}

export interface CostLine {
  step: string;
  model: string;
  usd: number;
  cached: boolean;
  detail?: Record<string, unknown>;
}

/** Collects cost lines for one job. Cache hits are recorded at $0 but kept for visibility. */
export class CostLedger {
  readonly lines: CostLine[] = [];

  add(line: CostLine): void {
    this.lines.push({ ...line, usd: line.cached ? 0 : line.usd });
  }

  total(step?: string): number {
    return round(this.lines.filter((l) => !step || l.step === step).reduce((sum, l) => sum + l.usd, 0));
  }

  byStep(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const l of this.lines) out[l.step] = round((out[l.step] ?? 0) + l.usd);
    return out;
  }
}

export function round(usd: number): number {
  return Math.round(usd * 1e6) / 1e6;
}
