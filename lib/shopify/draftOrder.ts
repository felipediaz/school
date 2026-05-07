import { adminGraphQL } from "./client";

export interface DraftLineItem {
  variantId?: string;
  /** Custom title shown if no variant id is supplied (dev/sandbox flows). */
  title?: string;
  priceUsd?: number;
  quantity: number;
  customAttributes: Record<string, string>;
}

export interface DraftOrderResult {
  draftOrderId: string;
  invoiceUrl: string;
}

const MUTATION = /* GraphQL */ `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function createDraftOrder(items: DraftLineItem[], email?: string): Promise<DraftOrderResult> {
  const lineItems = items.map((it) => {
    const customAttributes = Object.entries(it.customAttributes).map(([key, value]) => ({
      key,
      value,
    }));
    if (it.variantId) {
      return {
        variantId: it.variantId,
        quantity: it.quantity,
        customAttributes,
      };
    }
    return {
      title: it.title ?? "Custom print",
      originalUnitPrice: (it.priceUsd ?? 0).toFixed(2),
      quantity: it.quantity,
      customAttributes,
      taxable: true,
      requiresShipping: true,
    };
  });

  const data = await adminGraphQL<{
    draftOrderCreate: {
      draftOrder: { id: string; invoiceUrl: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(MUTATION, { input: { lineItems, email, useCustomerDefaultAddress: true } });

  const out = data.draftOrderCreate;
  if (!out.draftOrder) {
    throw new Error(`draftOrderCreate failed: ${out.userErrors.map((e) => e.message).join("; ")}`);
  }
  return { draftOrderId: out.draftOrder.id, invoiceUrl: out.draftOrder.invoiceUrl };
}
