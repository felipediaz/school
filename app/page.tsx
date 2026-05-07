import Link from "next/link";
import { PRODUCT_LIST } from "@/lib/products/specs";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Design your print job</h1>
        <p className="max-w-2xl text-ink/70">
          Pick a product, design both sides in the browser, and check out through
          our shop. Approved orders are sent straight to our print partner with
          full bleed and a guaranteed 300&nbsp;DPI export.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCT_LIST.map((p) => (
          <Link key={p.key} href={`/design/${p.key}`} className="card flex flex-col gap-2 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-xs uppercase tracking-wide text-ink/50">
              {p.widthIn}&quot; × {p.heightIn}&quot; · {p.sides === 2 ? "double-sided" : "single-sided"}
            </div>
            <div className="text-lg font-medium">{p.label}</div>
            <p className="text-sm text-ink/70">{p.blurb}</p>
            <div className="mt-auto pt-3 text-sm font-medium text-ink underline-offset-2 group-hover:underline">
              Start designing →
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
