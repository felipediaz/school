/**
 * Source of truth for every print product the editor + renderer + Shopify
 * mapping share. Dimensions are in inches; bleed/safe values follow the
 * standard print industry conventions ZooPrinting expects.
 */

export type ProductKey =
  | "business-card"
  | "postcard-4x6"
  | "postcard-5x7"
  | "envelope-10"
  | "flyer-letter";

export interface PaperOption {
  id: string;
  label: string;
  /** Shopify variant id once products exist in the store */
  shopifyVariantId?: string;
}

export interface QuantityTier {
  qty: number;
  /** USD subtotal hint for the cart UI; Shopify is source of truth at checkout */
  priceUsd: number;
}

export interface ProductSpec {
  key: ProductKey;
  label: string;
  blurb: string;
  /** Trim width (the final printed size) in inches. */
  widthIn: number;
  heightIn: number;
  /** Bleed extension on every side in inches (artwork must extend this far). */
  bleedIn: number;
  /** Safe-zone inset from trim edge in inches (text/logos must stay inside). */
  safeIn: number;
  /** Required print resolution. */
  dpi: number;
  /** How many sides the customer can design. */
  sides: 1 | 2;
  /** Optional product-specific guides drawn on the editor canvas. */
  extraGuides?: GuideSpec[];
  paper: PaperOption[];
  quantities: QuantityTier[];
}

export interface GuideSpec {
  /** Side index this guide applies to (0 = front). */
  side: number;
  label: string;
  /** Rect in inches, measured from the top-left of the *trim* area. */
  xIn: number;
  yIn: number;
  widthIn: number;
  heightIn: number;
  color: string;
}

const DPI = 300;

export const PRODUCT_SPECS: Record<ProductKey, ProductSpec> = {
  "business-card": {
    key: "business-card",
    label: "Business Cards",
    blurb: "3.5\" × 2\" — double-sided, 16pt or 32pt stock.",
    widthIn: 3.5,
    heightIn: 2,
    bleedIn: 0.125,
    safeIn: 0.125,
    dpi: DPI,
    sides: 2,
    paper: [
      { id: "16pt-matte", label: "16pt Matte" },
      { id: "16pt-gloss", label: "16pt Gloss" },
      { id: "32pt-uncoated", label: "32pt Uncoated" },
    ],
    quantities: [
      { qty: 100, priceUsd: 29 },
      { qty: 250, priceUsd: 49 },
      { qty: 500, priceUsd: 79 },
      { qty: 1000, priceUsd: 119 },
    ],
  },
  "postcard-4x6": {
    key: "postcard-4x6",
    label: "Postcards 4×6",
    blurb: "Standard 4\" × 6\" mailer. Double-sided.",
    widthIn: 6,
    heightIn: 4,
    bleedIn: 0.125,
    safeIn: 0.125,
    dpi: DPI,
    sides: 2,
    paper: [
      { id: "14pt-gloss", label: "14pt Gloss" },
      { id: "14pt-matte", label: "14pt Matte" },
      { id: "16pt-uncoated", label: "16pt Uncoated (writable)" },
    ],
    quantities: [
      { qty: 250, priceUsd: 79 },
      { qty: 500, priceUsd: 119 },
      { qty: 1000, priceUsd: 169 },
      { qty: 2500, priceUsd: 299 },
    ],
  },
  "postcard-5x7": {
    key: "postcard-5x7",
    label: "Postcards 5×7",
    blurb: "Larger 5\" × 7\" mailer. Double-sided.",
    widthIn: 7,
    heightIn: 5,
    bleedIn: 0.125,
    safeIn: 0.125,
    dpi: DPI,
    sides: 2,
    paper: [
      { id: "14pt-gloss", label: "14pt Gloss" },
      { id: "14pt-matte", label: "14pt Matte" },
      { id: "16pt-uncoated", label: "16pt Uncoated (writable)" },
    ],
    quantities: [
      { qty: 250, priceUsd: 99 },
      { qty: 500, priceUsd: 149 },
      { qty: 1000, priceUsd: 219 },
      { qty: 2500, priceUsd: 379 },
    ],
  },
  "envelope-10": {
    key: "envelope-10",
    label: "#10 Envelopes",
    blurb: "Standard #10 business envelope. Single-sided.",
    widthIn: 9.5,
    heightIn: 4.125,
    bleedIn: 0.125,
    safeIn: 0.25,
    dpi: DPI,
    sides: 1,
    /** Window envelope address area + return address guide. */
    extraGuides: [
      {
        side: 0,
        label: "Return address",
        xIn: 0.375,
        yIn: 0.375,
        widthIn: 3.0,
        heightIn: 0.875,
        color: "#7c3aed",
      },
      {
        side: 0,
        label: "Address window (optional)",
        xIn: 0.875,
        yIn: 2.125,
        widthIn: 4.5,
        heightIn: 1.125,
        color: "#0ea5e9",
      },
    ],
    paper: [
      { id: "24lb-white", label: "24lb White Wove" },
      { id: "24lb-natural", label: "24lb Natural" },
    ],
    quantities: [
      { qty: 250, priceUsd: 89 },
      { qty: 500, priceUsd: 139 },
      { qty: 1000, priceUsd: 199 },
    ],
  },
  "flyer-letter": {
    key: "flyer-letter",
    label: "Flyers 8.5×11",
    blurb: "US-letter flyer. Single- or double-sided.",
    widthIn: 8.5,
    heightIn: 11,
    bleedIn: 0.125,
    safeIn: 0.25,
    dpi: DPI,
    sides: 2,
    paper: [
      { id: "100lb-gloss", label: "100lb Gloss Text" },
      { id: "100lb-matte", label: "100lb Matte Text" },
      { id: "70lb-uncoated", label: "70lb Uncoated" },
    ],
    quantities: [
      { qty: 100, priceUsd: 49 },
      { qty: 250, priceUsd: 89 },
      { qty: 500, priceUsd: 139 },
      { qty: 1000, priceUsd: 199 },
    ],
  },
};

export const PRODUCT_LIST: ProductSpec[] = Object.values(PRODUCT_SPECS);

export function getProductSpec(key: string): ProductSpec | undefined {
  return PRODUCT_SPECS[key as ProductKey];
}

export function canvasPxSize(spec: ProductSpec): { width: number; height: number } {
  const total = (n: number) => Math.round((n + 2 * spec.bleedIn) * spec.dpi);
  return { width: total(spec.widthIn), height: total(spec.heightIn) };
}
