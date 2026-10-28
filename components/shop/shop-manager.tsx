"use client";

// The seller's Shop Manager panel: this week's numbers per product, the agent's morning report,
// and its suggestions, each applied only when the seller taps Approve.

import { useCallback, useEffect, useState } from "react";
import type { AgentAction, Report, ShopMetrics } from "@/lib/shop/manager";

const KIND_LABEL: Record<AgentAction["kind"], string> = {
  update_description: "Rewrite the description",
  set_offer: "Add an offer badge",
  add_size_image: "Add a true-size picture",
};

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-kit-edit": token } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-paper px-3 py-3">
      <span className="font-display text-[34px] leading-none text-ink">{value}</span>
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
    </div>
  );
}

function ActionCard({ action, onDecide }: { action: AgentAction; onDecide: (decision: "approve" | "dismiss") => Promise<void> }) {
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const detail = typeof action.payload.description === "string" ? action.payload.description : typeof action.payload.offer === "string" ? action.payload.offer : null;
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-ink">
          {KIND_LABEL[action.kind]}
          {action.itemName ? ` · ${action.itemName}` : ""}
        </span>
        <span className="text-[14px] text-ink-muted">{action.reason}</span>
      </div>
      {detail && <p className="rounded-xl bg-card px-3 py-2 text-[15px] text-ink">{detail}</p>}
      {action.status === "proposed" ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("approve");
              await onDecide("approve");
              setBusy(null);
            }}
            className="kit-press rounded-full bg-cobalt-500 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-cobalt-600 disabled:opacity-60"
          >
            {busy === "approve" ? (action.kind === "add_size_image" ? "Making the picture" : "Applying") : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("dismiss");
              await onDecide("dismiss");
              setBusy(null);
            }}
            className="rounded-full px-4 py-2.5 text-[14px] font-medium text-ink-muted hover:text-ink disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <span className={`text-[14px] font-medium ${action.status === "applied" ? "text-cobalt-600" : "text-ink-muted"}`}>
          {action.status === "applied" ? "Approved and live on your page" : action.status === "failed" ? "Couldn't apply this one" : "Dismissed"}
        </span>
      )}
    </li>
  );
}

export function ShopManager({ pageId, token, onApplied }: { pageId: string; token: string; onApplied: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<ShopMetrics | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "writing">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const out = await call<{ report: Report | null; metrics: ShopMetrics }>(`/api/pages/${pageId}/report`, token);
      setReport(out.report);
      setMetrics(out.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your numbers.");
    } finally {
      setState("idle");
    }
  }, [pageId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function write() {
    setState("writing");
    setError(null);
    try {
      const out = await call<{ report: Report; metrics: ShopMetrics }>(`/api/pages/${pageId}/report`, token, { method: "POST" });
      setReport(out.report);
      setMetrics(out.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Shop Manager couldn't finish.");
    } finally {
      setState("idle");
    }
  }

  async function decide(actionId: string, decision: "approve" | "dismiss") {
    try {
      const { status } = await call<{ status: AgentAction["status"] }>(`/api/pages/${pageId}/actions/${actionId}`, token, { method: "POST", body: JSON.stringify({ decision }) });
      setReport((r) => (r ? { ...r, actions: r.actions.map((a) => (a.id === actionId ? { ...a, status } : a)) } : r));
      if (status === "applied") onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply that.");
    }
  }

  const totals = metrics?.products.reduce((t, p) => ({ open3d: t.open3d + p.open3d, ar: t.ar + p.openAr, asks: t.asks + p.questions, orders: t.orders + p.orders }), { open3d: 0, ar: 0, asks: 0, orders: 0 });

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-card p-6" aria-label="Shop Manager">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="font-display text-[40px] leading-none text-ink">
          Shop <span className="italic">Manager</span>
        </h2>
        <p className="max-w-[46ch] text-[15px] text-ink-muted">Reads what customers did and asked, then suggests changes. Nothing changes until you approve it.</p>
      </div>

      {metrics && totals && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Visits" value={metrics.pageViews} />
          <Stat label="3D opens" value={totals.open3d} />
          <Stat label="In room" value={totals.ar} />
          <Stat label="Questions" value={totals.asks} />
          <Stat label="Orders" value={totals.orders} />
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-3">
          <p className="whitespace-pre-line rounded-2xl bg-cobalt-50 px-5 py-4 text-[16px] leading-relaxed text-ink">{report.summary}</p>
          {report.actions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {report.actions.map((a) => (
                <ActionCard key={a.id} action={a} onDecide={(d) => decide(a.id, d)} />
              ))}
            </ul>
          )}
          <p className="text-center text-[12px] text-ink-faint">
            Written {new Date(report.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} by Muse Wonder
          </p>
        </div>
      )}

      {error && <p className="text-center text-[14px] text-destructive">{error}</p>}

      <button
        type="button"
        onClick={write}
        disabled={state !== "idle"}
        className="kit-press self-center rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white disabled:opacity-60"
      >
        {state === "writing" ? "Reading your numbers and questions…" : report ? "Write a fresh report" : "Get my morning report"}
      </button>
    </section>
  );
}
