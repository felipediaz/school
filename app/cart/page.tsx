import Link from "next/link";
import { prisma } from "@/lib/db";
import { getProductSpec } from "@/lib/products/specs";
import CartClient from "./CartClient";

export default async function CartPage() {
  // For v1: show the most recent designs as a simple "cart" — the user
  // confirms quantity/paper here, then we hand off to Shopify.
  const recent = await prisma.design.findMany({
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  const items = recent
    .map((d) => {
      const spec = getProductSpec(d.productKey);
      if (!spec) return null;
      return {
        designId: d.id,
        name: d.name,
        productKey: spec.key,
        productLabel: spec.label,
        paper: spec.paper,
        quantities: spec.quantities,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">Your cart is empty</h1>
        <p className="text-sm text-ink/70">Pick a product to start designing.</p>
        <Link href="/" className="btn-primary">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      <CartClient items={items} />
    </div>
  );
}
