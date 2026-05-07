import path from "node:path";
import { promises as fs } from "node:fs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { ProductSpec } from "@/lib/products/specs";
import type { DesignDocument } from "@/lib/editor/serialize";
import { absoluteFor } from "@/lib/storage/fs";

type PDFColor = ReturnType<typeof rgb>;

/**
 * Render a saved design into a print-ready PDF.
 *
 * One PDF per design. If the product has 2 sides, the PDF has 2 pages
 * (page 1 = front, page 2 = back). Page size = trim + 2× bleed; artwork
 * coordinates are interpreted as `(spec.widthIn + 2·bleedIn) × dpi` px.
 *
 * The renderer walks the Fabric JSON directly (no headless browser) so the
 * output is fully vector for text and shapes; raster images are embedded as
 * PNG/JPEG.
 */
export async function renderDesignPdf(
  design: DesignDocument,
  spec: ProductSpec,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.label} (${spec.key})`);
  pdf.setProducer("Printshop Designer");

  const fonts = await loadStandardFonts(pdf);

  const totalWIn = spec.widthIn + 2 * spec.bleedIn;
  const totalHIn = spec.heightIn + 2 * spec.bleedIn;
  const pageW = totalWIn * 72; // PDF user units = 72 per inch
  const pageH = totalHIn * 72;

  // Fabric JSON coordinates were captured at the editor's display ppi. The
  // canvas we exported was sized at `(totalWIn) * displayPpi` px, so the
  // mapping from canvas px to PDF points is uniform: pt = px * 72 / displayPpi.
  // We embed that scale below by using each side's `displayPpi` if present,
  // falling back to spec.dpi.

  for (let i = 0; i < spec.sides; i++) {
    const sideData = design.sides[i] ?? { objects: [] };
    const page = pdf.addPage([pageW, pageH]);
    const ppi = sideData.ppi ?? spec.dpi;
    const scale = 72 / ppi;
    if (sideData.background) {
      const c = parseColor(sideData.background) ?? { r: 1, g: 1, b: 1 };
      page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(c.r, c.g, c.b) });
    }
    await drawObjects(pdf, page, sideData.objects ?? [], scale, pageH, fonts);
  }

  return pdf.save();
}

interface FontBundle {
  Helvetica: PDFFont;
  HelveticaBold: PDFFont;
  HelveticaOblique: PDFFont;
  TimesRoman: PDFFont;
  TimesBold: PDFFont;
  Courier: PDFFont;
}

async function loadStandardFonts(pdf: PDFDocument): Promise<FontBundle> {
  return {
    Helvetica: await pdf.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    HelveticaOblique: await pdf.embedFont(StandardFonts.HelveticaOblique),
    TimesRoman: await pdf.embedFont(StandardFonts.TimesRoman),
    TimesBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    Courier: await pdf.embedFont(StandardFonts.Courier),
  };
}

function pickFont(fonts: FontBundle, family: string | undefined, weight: string | undefined, italic: boolean): PDFFont {
  const f = (family ?? "").toLowerCase();
  const bold = /bold|700|800|900/.test(String(weight ?? ""));
  if (f.includes("times") || f.includes("georgia") || f.includes("serif")) {
    return bold ? fonts.TimesBold : fonts.TimesRoman;
  }
  if (f.includes("courier") || f.includes("mono")) return fonts.Courier;
  if (italic) return fonts.HelveticaOblique;
  return bold ? fonts.HelveticaBold : fonts.Helvetica;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

function parseColor(input: string | undefined | null): Color | null {
  if (!input || input === "transparent") return null;
  const s = input.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0").slice(0, 6);
    const n = parseInt(full, 16);
    return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
  }
  const rgbMatch = s.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((v) => parseFloat(v.trim()));
    return { r: (parts[0] ?? 0) / 255, g: (parts[1] ?? 0) / 255, b: (parts[2] ?? 0) / 255 };
  }
  return null;
}

function asRgb(c: Color | null): PDFColor | undefined {
  return c ? rgb(c.r, c.g, c.b) : undefined;
}

interface FabricObj {
  type?: string;
  excludeFromExport?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fontSize?: number;
  text?: string;
  rx?: number;
  ry?: number;
  radius?: number;
  src?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

async function drawObjects(
  pdf: PDFDocument,
  page: PDFPage,
  objects: unknown[],
  scale: number,
  pageH: number,
  fonts: FontBundle,
): Promise<void> {
  for (const raw of objects) {
    const obj = raw as FabricObj;
    if (!obj || obj.excludeFromExport) continue;
    const left = (obj.left ?? 0) * scale;
    const top = (obj.top ?? 0) * scale;
    const w = (obj.width ?? 0) * (obj.scaleX ?? 1) * scale;
    const h = (obj.height ?? 0) * (obj.scaleY ?? 1) * scale;
    // Convert from top-left (canvas) to bottom-left (PDF).
    const x = left;
    const y = pageH - top - h;
    // Note: rotation is intentionally not honored in v1 — the editor will
    // discourage rotated artwork via a UI nudge. Add `degrees(obj.angle)`
    // here once we have a clear print-shop spec for it.
    const fill = parseColor(obj.fill ?? null);
    const stroke = parseColor(obj.stroke ?? null);
    const borderWidth = (obj.strokeWidth ?? 0) * scale;

    switch (obj.type) {
      case "Rect":
      case "rect": {
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: asRgb(fill),
          borderColor: asRgb(stroke),
          borderWidth: stroke ? borderWidth : 0,
        });
        break;
      }
      case "Circle":
      case "circle": {
        const r = (obj.radius ?? 0) * (obj.scaleX ?? 1) * scale;
        page.drawCircle({
          x: x + r,
          y: y + r,
          size: r,
          color: asRgb(fill),
          borderColor: asRgb(stroke),
          borderWidth: stroke ? borderWidth : 0,
        });
        break;
      }
      case "Line":
      case "line": {
        const x1 = (obj.x1 ?? 0) * scale + left;
        const y1 = pageH - ((obj.y1 ?? 0) * scale + top);
        const x2 = (obj.x2 ?? 0) * scale + left;
        const y2 = pageH - ((obj.y2 ?? 0) * scale + top);
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          color: asRgb(stroke ?? fill ?? { r: 0, g: 0, b: 0 }),
          thickness: borderWidth || 1,
        });
        break;
      }
      case "Textbox":
      case "IText":
      case "Text":
      case "i-text":
      case "textbox":
      case "text": {
        const text = String(obj.text ?? "");
        if (!text) break;
        const size = (obj.fontSize ?? 16) * (obj.scaleY ?? 1) * scale;
        const font = pickFont(
          fonts,
          obj.fontFamily,
          String(obj.fontWeight ?? ""),
          (obj.fontStyle ?? "").toLowerCase().includes("italic"),
        );
        // pdf-lib's text origin is the baseline; nudge by the font ascent.
        const ascent = font.heightAtSize(size, { descender: false });
        const lines = text.split("\n");
        let cursorY = y + h - ascent;
        for (const line of lines) {
          page.drawText(line, {
            x,
            y: cursorY,
            size,
            font,
            color: asRgb(fill ?? { r: 0, g: 0, b: 0 }),
          });
          cursorY -= size * 1.2;
        }
        break;
      }
      case "Image":
      case "image": {
        await drawImage(pdf, page, obj, x, y, w, h);
        break;
      }
      case "Group":
      case "group": {
        const children = (raw as { objects?: unknown[] }).objects;
        if (Array.isArray(children)) {
          await drawObjects(pdf, page, children, scale, pageH, fonts);
        }
        break;
      }
      default:
        // Unknown type — skip silently. Editor only emits the types above.
        break;
    }
  }
}

async function drawImage(pdf: PDFDocument, page: PDFPage, obj: FabricObj, x: number, y: number, w: number, h: number) {
  const src = obj.src;
  if (!src) return;
  let bytes: Uint8Array | null = null;
  let mime = "";
  if (src.startsWith("data:")) {
    const m = src.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return;
    mime = m[1];
    bytes = Buffer.from(m[2], "base64");
  } else if (src.startsWith("/storage/") || src.startsWith("storage/") || src.startsWith("uploads/")) {
    const rel = src.replace(/^\/?storage\//, "").replace(/^\/+/, "");
    try {
      const abs = absoluteFor(rel);
      bytes = new Uint8Array(await fs.readFile(abs));
      mime = guessMime(abs);
    } catch {
      return;
    }
  } else {
    // External URL
    try {
      const res = await fetch(src);
      if (!res.ok) return;
      mime = res.headers.get("content-type") ?? "image/png";
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      return;
    }
  }
  if (!bytes) return;
  const img = mime.includes("jpeg") || mime.includes("jpg")
    ? await pdf.embedJpg(bytes)
    : await pdf.embedPng(bytes);
  page.drawImage(img, { x, y, width: w, height: h });
}

function guessMime(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}
