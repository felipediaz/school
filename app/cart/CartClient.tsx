"use client";

import Link from "next/link";
import { useState } from "react";

import type { PaperOption, QuantityTier } from "@/lib/products/specs";

interface CartItem {
  designId: string;
  name: string;
  productKey: string;
  productLabel: string;
  paper: PaperOption[];
  quantities: QuantityTier[];
}

export default function CartClient({ items }: { items: CartItem[] }) {
  const [selections, setSelections] = useState<Record<string, { paperId: string; qty: number; selected: boolean }>>(
    () =>
      Object.fromEntries(
        items.map((i) => [
          i.designId,
          { paperId: i.paper[0]?.id ?? "", qty: i.quantities[0]?.qty ?? 0, selected: false },
        ]),
      ),
  );
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(designId: string, patch: Partial<{ paperId: string; qty: number; selected: boolean }>) {
    setSelections((s) => ({ ...s, [designId]: { ...s[designId], ...patch } }));
  }

  const total = items.reduce((sum, it) => {
    const sel = selections[it.designId];
    if (!sel?.selected) return sum;
    const tier = it.quantities.find((q) => q.qty === sel.qty) ?? it.quantities[0];
    return sum + (tier?.priceUsd ?? 0);
  }, 0);

  async function checkout() {
    setError(null);
    const lines = items
      .filter((it) => selections[it.designId]?.selected)
      .map((it) => ({
        designId: it.designId,
        paperId: selections[it.designId].paperId,
        quantity: selections[it.designId].qty,
      }));
    if (lines.length === 0) {
      setError("Pick at least one design.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined, items: lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.[0] || json.error || "checkout failed");
      window.location.href = json.invoiceUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {items.map((it) => {
          const sel = selections[it.designId];
          return (
            <div key={it.designId} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={sel.selected}
                  onChange={(e) => update(it.designId, { selected: e.target.checked })}
                />
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-ink/60">{it.productLabel}</div>
                </div>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sel.paperId}
                  onChange={(e) => update(it.designId, { paperId: e.target.value })}
                  className="rounded border border-ink/20 px-2 py-1 text-sm"
                >
                  {it.paper.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <select
                  value={sel.qty}
                  onChange={(e) => update(it.designId, { qty: Number(e.target.value) })}
                  className="rounded border border-ink/20 px-2 py-1 text-sm"
                >
                  {it.quantities.map((q) => (
                    <option key={q.qty} value={q.qty}>
                      {q.qty} · ${q.priceUsd.toFixed(2)}
                    </option>
                  ))}
                </select>
                <Link
                  href={`/design/${it.productKey}?design=${it.designId}`}
                  className="btn"
                >
                  Edit
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-ink/70">Estimated total</div>
          <div className="text-xl font-semibold">${total.toFixed(2)}</div>
        </div>
        <input
          type="email"
          placeholder="Email for order receipt (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-ink/20 px-3 py-2 text-sm"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => void checkout()}
          disabled={submitting}
        >
          {submitting ? "Creating checkout…" : "Checkout with Shopify →"}
        </button>
        <p className="text-xs text-ink/60">
          Final price, taxes and shipping are calculated by Shopify on the
          checkout page. Your design is attached to the order so we can send it
          to the printer immediately after payment.
        </p>
      </div>
    </div>
  );
}
