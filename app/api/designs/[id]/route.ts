import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ design });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.design.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
