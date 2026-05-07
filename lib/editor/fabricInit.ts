"use client";

import * as fabric from "fabric";
import type { ProductSpec } from "@/lib/products/specs";

export interface EditorChrome {
  canvas: fabric.Canvas;
  /** Px-per-inch the canvas was created at (display DPI, not print DPI). */
  displayPpi: number;
  /** Group of guide objects (bleed/trim/safe + product-specific). */
  guides: fabric.Object[];
}

export interface InitOptions {
  /** Width of the editor viewport in px; we scale the print size to fit. */
  viewportWidthPx: number;
  /** Optional viewport height; used to also fit tall products (flyer) on phones. */
  viewportHeightPx?: number;
  /** Initial side index (0 = front). */
  side: number;
  spec: ProductSpec;
}

export function computeDisplayPpi(
  spec: ProductSpec,
  viewportWidthPx: number,
  viewportHeightPx?: number,
): number {
  const totalWIn = spec.widthIn + 2 * spec.bleedIn;
  const totalHIn = spec.heightIn + 2 * spec.bleedIn;
  const fromW = Math.floor(viewportWidthPx / totalWIn);
  const fromH = viewportHeightPx ? Math.floor(viewportHeightPx / totalHIn) : Infinity;
  return Math.max(48, Math.min(spec.dpi, Math.min(fromW, fromH)));
}

/** Touch-friendly defaults applied to every selectable Fabric object. */
export function applyTouchDefaults(): void {
  fabric.FabricObject.ownDefaults = {
    ...fabric.FabricObject.ownDefaults,
    cornerSize: 18,
    touchCornerSize: 36,
    cornerStyle: "circle",
    cornerColor: "#111111",
    cornerStrokeColor: "#ffffff",
    transparentCorners: false,
    borderColor: "#111111",
    padding: 6,
    // Rotation is awkward on touch and we don't honor it in the PDF
    // renderer yet — hide the rotate handle.
    hasRotatingPoint: false,
  } as typeof fabric.FabricObject.ownDefaults;
}

export function initCanvas(el: HTMLCanvasElement, opts: InitOptions): EditorChrome {
  const { spec } = opts;
  applyTouchDefaults();
  const ppi = computeDisplayPpi(spec, opts.viewportWidthPx, opts.viewportHeightPx);
  const totalW = (spec.widthIn + 2 * spec.bleedIn) * ppi;
  const totalH = (spec.heightIn + 2 * spec.bleedIn) * ppi;

  const canvas = new fabric.Canvas(el, {
    width: totalW,
    height: totalH,
    backgroundColor: "#ffffff",
    preserveObjectStacking: true,
    selection: true,
    // Better touch experience: stop iOS Safari from selecting page text on
    // long-press, and disable browser pinch over the canvas.
    allowTouchScrolling: false,
    enableRetinaScaling: true,
  });

  const guides = drawGuides(canvas, spec, ppi);
  return { canvas, displayPpi: ppi, guides };
}

export function drawGuides(
  canvas: fabric.Canvas,
  spec: ProductSpec,
  ppi: number,
): fabric.Object[] {
  const totalW = (spec.widthIn + 2 * spec.bleedIn) * ppi;
  const totalH = (spec.heightIn + 2 * spec.bleedIn) * ppi;
  const trimX = spec.bleedIn * ppi;
  const trimY = spec.bleedIn * ppi;
  const trimW = spec.widthIn * ppi;
  const trimH = spec.heightIn * ppi;
  const safeX = trimX + spec.safeIn * ppi;
  const safeY = trimY + spec.safeIn * ppi;
  const safeW = trimW - 2 * spec.safeIn * ppi;
  const safeH = trimH - 2 * spec.safeIn * ppi;

  const guideOpts = {
    fill: "transparent",
    selectable: false,
    evented: false,
    hoverCursor: "default",
    excludeFromExport: true,
  } as const;

  const bleed = new fabric.Rect({
    left: 0,
    top: 0,
    width: totalW - 1,
    height: totalH - 1,
    stroke: "#dc2626",
    strokeDashArray: [8, 6],
    strokeWidth: 1,
    ...guideOpts,
  });
  const trim = new fabric.Rect({
    left: trimX,
    top: trimY,
    width: trimW,
    height: trimH,
    stroke: "#111111",
    strokeWidth: 1,
    ...guideOpts,
  });
  const safe = new fabric.Rect({
    left: safeX,
    top: safeY,
    width: safeW,
    height: safeH,
    stroke: "#2563eb",
    strokeDashArray: [4, 4],
    strokeWidth: 1,
    ...guideOpts,
  });

  const all: fabric.Object[] = [bleed, trim, safe];

  for (const g of spec.extraGuides ?? []) {
    const rect = new fabric.Rect({
      left: trimX + g.xIn * ppi,
      top: trimY + g.yIn * ppi,
      width: g.widthIn * ppi,
      height: g.heightIn * ppi,
      stroke: g.color,
      strokeDashArray: [3, 3],
      strokeWidth: 1,
      ...guideOpts,
    });
    all.push(rect);
  }

  for (const obj of all) canvas.add(obj);
  for (const obj of all) canvas.bringObjectToFront(obj);
  canvas.requestRenderAll();
  return all;
}

/** Reset canvas state and re-draw guides; useful when switching sides. */
export function clearArtwork(canvas: fabric.Canvas, guides: fabric.Object[]): void {
  const keep = new Set(guides);
  for (const obj of canvas.getObjects().slice()) {
    if (!keep.has(obj)) canvas.remove(obj);
  }
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

/** Serialize artwork only (guides excluded via excludeFromExport). */
export function serializeSide(canvas: fabric.Canvas) {
  return canvas.toJSON();
}

export async function loadSide(
  canvas: fabric.Canvas,
  guides: fabric.Object[],
  data: { objects: unknown[]; background?: string } | null,
): Promise<void> {
  clearArtwork(canvas, guides);
  if (!data || !data.objects?.length) return;
  await canvas.loadFromJSON(data);
  canvas.requestRenderAll();
}
