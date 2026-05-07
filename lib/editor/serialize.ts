import type { ProductKey } from "@/lib/products/specs";

export const DESIGN_FORMAT_VERSION = 1;

/** Per-side payload as produced by `fabric.Canvas.toJSON(["customProps"...])`. */
export type FabricSide = {
  version?: string;
  objects: unknown[];
  background?: string;
  /** Display ppi at which the canvas was serialized (used by PDF renderer). */
  ppi?: number;
};

export interface DesignDocument {
  version: number;
  productKey: ProductKey;
  sides: FabricSide[];
}

export function emptyDesign(productKey: ProductKey, sides: number): DesignDocument {
  return {
    version: DESIGN_FORMAT_VERSION,
    productKey,
    sides: Array.from({ length: sides }, () => ({ objects: [], background: "#ffffff" })),
  };
}

export function isDesignDocument(value: unknown): value is DesignDocument {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DesignDocument>;
  return (
    typeof v.version === "number" &&
    typeof v.productKey === "string" &&
    Array.isArray(v.sides) &&
    v.sides.every((s) => s && typeof s === "object" && Array.isArray((s as FabricSide).objects))
  );
}
