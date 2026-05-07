import crypto from "node:crypto";

/**
 * Verify Shopify-sent webhook HMAC. Shopify signs the *raw* body with the
 * shared secret using SHA-256, base64-encoded, and provides it via the
 * `X-Shopify-Hmac-Sha256` header.
 */
export function verifyShopifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface ShopifyOrderLineItem {
  id: number;
  title: string;
  quantity: number;
  variant_id: number | null;
  properties?: Array<{ name: string; value: string }>;
}

export interface ShopifyOrderPayload {
  id: number;
  order_number: number;
  name: string;
  email?: string;
  total_price?: string;
  line_items: ShopifyOrderLineItem[];
}

export function lineItemAttr(item: ShopifyOrderLineItem, key: string): string | undefined {
  return item.properties?.find((p) => p.name === key)?.value;
}
