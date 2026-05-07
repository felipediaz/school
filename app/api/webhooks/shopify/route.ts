import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getProductSpec } from "@/lib/products/specs";
import { isDesignDocument } from "@/lib/editor/serialize";
import { renderDesignPdf } from "@/lib/pdf/render";
import { saveOrderPdf } from "@/lib/storage/fs";
import { getFulfiller } from "@/lib/fulfillment/PrintFulfiller";
import {
  lineItemAttr,
  type ShopifyOrderPayload,
  verifyShopifyHmac,
} from "@/lib/shopify/webhook";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(raw, hmac)) {
    return NextResponse.json({ error: "invalid hmac" }, { status: 401 });
  }
  const topic = req.headers.get("x-shopify-topic") ?? "";
  if (topic !== "orders/paid") {
    // Acknowledge other topics so Shopify doesn't keep retrying.
    return NextResponse.json({ ok: true, ignored: topic });
  }

  const payload = JSON.parse(raw) as ShopifyOrderPayload;
  const fulfiller = await getFulfiller();

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: String(payload.id) },
    create: {
      shopifyOrderId: String(payload.id),
      shopifyOrderNo: payload.name,
      email: payload.email,
      totalUsd: payload.total_price ? payload.total_price : null,
      rawPayload: payload as unknown as object,
      status: "received",
    },
    update: {
      rawPayload: payload as unknown as object,
      status: "received",
    },
  });

  const itemsForJob: Array<{
    shopifyLineId: string;
    productKey: string;
    quantity: number;
    paper: string | null;
    pdfPaths: string[];
  }> = [];

  for (const li of payload.line_items) {
    const designId = lineItemAttr(li, "design_id");
    const productKey = lineItemAttr(li, "product_key");
    const paper = lineItemAttr(li, "paper") ?? null;
    const printQty = Number(lineItemAttr(li, "print_quantity") ?? li.quantity);
    if (!designId || !productKey) continue;
    const spec = getProductSpec(productKey);
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!spec || !design || !isDesignDocument(design.data)) continue;

    const pdfBytes = await renderDesignPdf(design.data, spec);
    const rel = await saveOrderPdf(payload.name, String(li.id), 0, pdfBytes);

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        shopifyLineId: String(li.id),
        designId: design.id,
        productKey,
        paper,
        quantity: printQty,
        pdfPaths: [rel],
      },
    });

    itemsForJob.push({
      shopifyLineId: String(li.id),
      productKey,
      quantity: printQty,
      paper,
      pdfPaths: [rel],
    });
  }

  let attemptStatus = "skipped";
  let attemptDetail = "no items required fulfillment";
  if (itemsForJob.length > 0) {
    try {
      const result = await fulfiller.submit({
        orderNumber: payload.name,
        email: payload.email,
        items: itemsForJob,
      });
      attemptStatus = result.ok ? "ok" : "failed";
      attemptDetail = result.detail;
    } catch (err) {
      attemptStatus = "failed";
      attemptDetail = err instanceof Error ? err.message : String(err);
    }
  }

  await prisma.fulfillmentAttempt.create({
    data: {
      orderId: order.id,
      fulfiller: fulfiller.id,
      status: attemptStatus,
      detail: attemptDetail,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: attemptStatus === "ok" ? "submitted" : "needs_attention" },
  });

  return NextResponse.json({ ok: attemptStatus === "ok", attemptStatus });
}
