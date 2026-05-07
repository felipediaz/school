import { notFound } from "next/navigation";
import { getProductSpec } from "@/lib/products/specs";
import Editor from "./Editor.client";

export default async function DesignPage({ params, searchParams }: {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ design?: string }>;
}) {
  const { product } = await params;
  const { design } = await searchParams;
  const spec = getProductSpec(product);
  if (!spec) notFound();

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink/50">
          {spec.widthIn}&quot; × {spec.heightIn}&quot; · {spec.dpi}&nbsp;DPI · {spec.sides === 2 ? "double-sided" : "single-sided"}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{spec.label}</h1>
      </div>
      <Editor spec={spec} initialDesignId={design ?? null} />
    </div>
  );
}
