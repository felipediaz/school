import type { ProductSpec } from "@/lib/products/specs";
import type { FabricSide } from "@/lib/editor/serialize";

/**
 * Templates are authored in **inches**, measured from the top-left of the
 * trim area. The `apply` step converts them to Fabric coordinates at the
 * editor's current display ppi and adds the bleed offset so the artwork
 * naturally extends past the trim where appropriate.
 */
export type TmplObject =
  | TmplRect
  | TmplCircle
  | TmplText
  | TmplLine;

export interface TmplBase {
  /** Anchor X in inches from left of trim. Negative = into the bleed. */
  xIn: number;
  /** Anchor Y in inches from top of trim. */
  yIn: number;
  /** Optional opacity (0..1). */
  opacity?: number;
}

export interface TmplRect extends TmplBase {
  kind: "rect";
  widthIn: number;
  heightIn: number;
  fill: string;
}

export interface TmplCircle extends TmplBase {
  kind: "circle";
  radiusIn: number;
  fill: string;
}

export interface TmplText extends TmplBase {
  kind: "text";
  text: string;
  /** Font size in inches (will be converted to px at the active ppi). */
  sizeIn: number;
  fill: string;
  fontFamily: string;
  fontWeight?: "normal" | "bold" | "900";
  textAlign?: "left" | "center" | "right";
  /** Optional textbox width in inches (wraps text). */
  widthIn?: number;
}

export interface TmplLine extends TmplBase {
  kind: "line";
  /** Endpoint relative to (xIn, yIn), in inches. */
  dxIn: number;
  dyIn: number;
  stroke: string;
  strokeWidthIn?: number;
}

export interface TmplSide {
  /** CSS color for the canvas background of this side. */
  background?: string;
  objects: TmplObject[];
}

export interface TemplateDef {
  id: string;
  name: string;
  category: "bold-colorful";
  /** Optional preview swatch — a couple of color stops for the gallery thumb. */
  swatch: string[];
  /** Predicate: which products this template suits. */
  supports: (spec: ProductSpec) => boolean;
  /** Build front (and optionally back) sides for a given product. */
  build: (spec: ProductSpec) => TmplSide[];
}

export interface AppliedTemplate {
  templateId: string;
  sides: FabricSide[];
}
