import type { ProductSpec } from "@/lib/products/specs";
import type { FabricSide } from "@/lib/editor/serialize";
import type { TemplateDef, TmplObject, TmplSide } from "./types";

/**
 * Convert a template (inches) into Fabric JSON sides at a specific display ppi.
 *
 * The editor's canvas width = (trimWidth + 2·bleed) · ppi. Templates are
 * authored in inches relative to the top-left of the trim area, so we add
 * `bleedIn · ppi` to each x/y to land at the right canvas pixel.
 */
export function templateToFabricSides(
  template: TemplateDef,
  spec: ProductSpec,
  ppi: number,
): FabricSide[] {
  const sides = template.build(spec);
  return sides.map((side) => sideToFabric(side, spec, ppi));
}

function sideToFabric(side: TmplSide, spec: ProductSpec, ppi: number): FabricSide {
  const offset = spec.bleedIn * ppi;
  return {
    background: side.background ?? "#ffffff",
    ppi,
    objects: side.objects.map((o) => objToFabric(o, offset, ppi)),
  };
}

function objToFabric(o: TmplObject, offsetPx: number, ppi: number): unknown {
  const left = o.xIn * ppi + offsetPx;
  const top = o.yIn * ppi + offsetPx;
  const opacity = o.opacity ?? 1;
  switch (o.kind) {
    case "rect":
      return {
        type: "Rect",
        left,
        top,
        width: o.widthIn * ppi,
        height: o.heightIn * ppi,
        fill: o.fill,
        opacity,
        scaleX: 1,
        scaleY: 1,
        strokeWidth: 0,
      };
    case "circle":
      return {
        type: "Circle",
        left,
        top,
        radius: o.radiusIn * ppi,
        fill: o.fill,
        opacity,
        scaleX: 1,
        scaleY: 1,
        strokeWidth: 0,
      };
    case "text":
      return {
        type: "Textbox",
        left,
        top,
        text: o.text,
        fontFamily: o.fontFamily,
        fontWeight: o.fontWeight ?? "normal",
        fontSize: o.sizeIn * ppi,
        fill: o.fill,
        textAlign: o.textAlign ?? "left",
        width: (o.widthIn ?? 4) * ppi,
        opacity,
        scaleX: 1,
        scaleY: 1,
        strokeWidth: 0,
        editable: true,
      };
    case "line":
      return {
        type: "Line",
        left,
        top,
        x1: 0,
        y1: 0,
        x2: o.dxIn * ppi,
        y2: o.dyIn * ppi,
        stroke: o.stroke,
        strokeWidth: (o.strokeWidthIn ?? 0.02) * ppi,
        opacity,
      };
  }
}
