const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

function shopOrThrow(): string {
  const shop = process.env.SHOPIFY_SHOP;
  if (!shop) throw new Error("SHOPIFY_SHOP not configured");
  return shop;
}

export async function adminGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token) throw new Error("SHOPIFY_ADMIN_TOKEN not configured");
  const res = await fetch(`https://${shopOrThrow()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Shopify Admin GraphQL ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Shopify Admin GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}

export async function storefrontGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!token) throw new Error("SHOPIFY_STOREFRONT_TOKEN not configured");
  const res = await fetch(`https://${shopOrThrow()}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Shopify Storefront GraphQL ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Shopify Storefront GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}
