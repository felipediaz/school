import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getProductSpec } from "@/lib/products/specs";

export const runtime = "nodejs";

const SaveDesign = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  productKey: z.string(),
  /** Versioned JSON envelope; we don't deep-validate Fabric here. */
  data: z.object({
    version: z.number(),
    productKey: z.string(),
    sides: z.array(z.object({ objects: z.array(z.unknown()) }).passthrough()),
  }).passthrough(),
  thumbnailUrl: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SaveDesign.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, name, productKey, data, thumbnailUrl } = parsed.data;
  if (!getProductSpec(productKey)) {
    return NextResponse.json({ error: "unknown productKey" }, { status: 400 });
  }

  if (id) {
    const updated = await prisma.design.update({
      where: { id },
      data: { name: name ?? undefined, productKey, data, thumbnailUrl: thumbnailUrl ?? undefined },
    });
    return NextResponse.json({ design: updated });
  }
  const created = await prisma.design.create({
    data: { name: name ?? "Untitled design", productKey, data, thumbnailUrl: thumbnailUrl ?? null },
  });
  return NextResponse.json({ design: created });
}

export async function GET() {
  const designs = await prisma.design.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, name: true, productKey: true, thumbnailUrl: true, updatedAt: true },
  });
  return NextResponse.json({ designs });
}
