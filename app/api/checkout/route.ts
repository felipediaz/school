import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getProductSpec } from "@/lib/products/specs";
import { createDraftOrder } from "@/lib/shopify/draftOrder";

export const runtime = "nodejs";

const CartItem = z.object({
  designId: z.string(),
  paperId: z.string(),
  quantity: z.number().int().positive(),
});

const Body = z.object({
  email: z.string().email().optional(),
  items: z.array(CartItem).min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, items } = parsed.data;
  const designs = await prisma.design.findMany({
    where: { id: { in: items.map((i) => i.designId) } },
  });
  const designMap = new Map(designs.map((d) => [d.id, d]));

  const lineItems = items.map((it) => {
    const design = designMap.get(it.designId);
    if (!design) throw new Error(`design ${it.designId} not found`);
    const spec = getProductSpec(design.productKey);
    if (!spec) throw new Error(`unknown productKey ${design.productKey}`);
    const tier = spec.quantities.find((q) => q.qty === it.quantity) ?? spec.quantities[0];
    const paper = spec.paper.find((p) => p.id === it.paperId) ?? spec.paper[0];
    return {
      variantId: paper.shopifyVariantId,
      title: `${spec.label} — ${paper.label} (${it.quantity})`,
      priceUsd: tier.priceUsd,
      quantity: 1, // billed as a single line; printed quantity is the tier
      customAttributes: {
        design_id: design.id,
        design_name: design.name,
        product_key: spec.key,
        paper: paper.id,
        print_quantity: String(it.quantity),
      },
    };
  });

  try {
    const result = await createDraftOrder(lineItems, email);
    return NextResponse.json({ invoiceUrl: result.invoiceUrl, draftOrderId: result.draftOrderId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
