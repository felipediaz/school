"use client";

import * as fabric from "fabric";

/**
 * Load a self-contained SVG string onto the canvas as a single Fabric group.
 * The element is recolored to `fill` (or stroke if the SVG uses currentColor
 * with `stroke="currentColor"`) and scaled so it sits at a sensible default
 * size relative to the canvas width.
 */
export async function addSvgFromString(
  canvas: fabric.Canvas,
  svgString: string,
  opts: { fill: string; targetWidthPx: number },
): Promise<fabric.Object | null> {
  // Replace currentColor so the loaded paths take the requested color.
  const colored = svgString.replace(/currentColor/g, opts.fill);

  const loaded = await fabric.loadSVGFromString(colored);
  const objs = (loaded.objects ?? []).filter(Boolean) as fabric.Object[];
  if (!objs.length) return null;
  const group = fabric.util.groupSVGElements(objs, loaded.options ?? {});
  // Scale to roughly opts.targetWidthPx wide.
  const w = group.width ?? opts.targetWidthPx;
  const scale = opts.targetWidthPx / w;
  group.scale(scale);
  group.set({ left: canvas.getWidth() / 2 - opts.targetWidthPx / 2, top: canvas.getHeight() / 2 - opts.targetWidthPx / 2 });
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  return group;
}
