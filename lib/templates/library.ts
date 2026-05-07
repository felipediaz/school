import type { ProductSpec } from "@/lib/products/specs";
import type { TemplateDef, TmplObject, TmplSide } from "./types";

/**
 * Bold / colorful starter templates. Every template is parametric in the
 * product's trim width/height (in inches), so the same layout adapts to
 * business cards, postcards, envelopes and flyers without re-authoring.
 *
 * Color choices: Vibrant magenta + teal + sun-yellow + ink black + paper
 * white. Saturated, high-contrast — the "bold/colorful" mood the user
 * picked.
 */

const COLORS = {
  magenta: "#ec4899",
  teal: "#14b8a6",
  yellow: "#facc15",
  ink: "#0f172a",
  paper: "#ffffff",
  paperDim: "#e2e8f0",
};

const FONT = {
  display: "Helvetica",
  body: "Helvetica",
};

function isLandscape(spec: ProductSpec): boolean {
  return spec.widthIn >= spec.heightIn;
}

function contactBlock(xIn: number, yIn: number, widthIn: number, sizeIn: number, fill: string): TmplObject {
  return {
    kind: "text",
    xIn,
    yIn,
    text: "yourname@email.com\n+1 555 555 1234\nyourwebsite.com",
    sizeIn,
    fill,
    fontFamily: FONT.body,
    widthIn,
    textAlign: "left",
  };
}

/* -------------------------------------------------------------------------- */
/* Template 1 — Vivid Block                                                   */
/* -------------------------------------------------------------------------- */

const vividBlock: TemplateDef = {
  id: "vivid-block",
  name: "Vivid Block",
  category: "bold-colorful",
  swatch: [COLORS.magenta, COLORS.paper],
  supports: () => true,
  build(spec) {
    const W = spec.widthIn;
    const H = spec.heightIn;
    const padding = Math.min(W, H) * 0.08;
    const blockW = W * 0.45;

    const front: TmplSide = {
      background: COLORS.paper,
      objects: [
        {
          kind: "rect",
          xIn: -spec.bleedIn,
          yIn: -spec.bleedIn,
          widthIn: blockW + spec.bleedIn,
          heightIn: H + 2 * spec.bleedIn,
          fill: COLORS.magenta,
        },
        {
          kind: "text",
          xIn: padding * 0.5,
          yIn: H * 0.30,
          text: "Your Name",
          sizeIn: H * 0.16,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "bold",
          widthIn: blockW - padding,
        },
        {
          kind: "text",
          xIn: padding * 0.5,
          yIn: H * 0.55,
          text: "Your Title",
          sizeIn: H * 0.07,
          fill: COLORS.paper,
          fontFamily: FONT.body,
          widthIn: blockW - padding,
        },
        contactBlock(blockW + padding, H * 0.30, W - blockW - padding * 1.5, H * 0.06, COLORS.ink),
      ],
    };

    if (spec.sides === 1) return [front];

    const back: TmplSide = {
      background: COLORS.magenta,
      objects: [
        {
          kind: "text",
          xIn: W * 0.1,
          yIn: H * 0.42,
          text: "YOUR\nLOGO",
          sizeIn: H * 0.18,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "bold",
          widthIn: W * 0.8,
          textAlign: "center",
        },
      ],
    };
    return [front, back];
  },
};

/* -------------------------------------------------------------------------- */
/* Template 2 — Big Initial                                                   */
/* -------------------------------------------------------------------------- */

const bigInitial: TemplateDef = {
  id: "big-initial",
  name: "Big Initial",
  category: "bold-colorful",
  swatch: [COLORS.teal, COLORS.paper],
  supports: () => true,
  build(spec) {
    const W = spec.widthIn;
    const H = spec.heightIn;

    const front: TmplSide = {
      background: COLORS.teal,
      objects: [
        {
          kind: "text",
          xIn: 0,
          yIn: H * 0.05,
          text: "Y",
          sizeIn: H * 0.65,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "900",
          widthIn: W,
          textAlign: "center",
        },
        {
          kind: "text",
          xIn: 0,
          yIn: H * 0.78,
          text: "Your Name",
          sizeIn: H * 0.09,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "bold",
          widthIn: W,
          textAlign: "center",
        },
        {
          kind: "text",
          xIn: 0,
          yIn: H * 0.90,
          text: "Your Title",
          sizeIn: H * 0.05,
          fill: COLORS.paper,
          fontFamily: FONT.body,
          widthIn: W,
          textAlign: "center",
          opacity: 0.85,
        },
      ],
    };

    if (spec.sides === 1) return [front];

    const back: TmplSide = {
      background: COLORS.paper,
      objects: [
        {
          kind: "rect",
          xIn: -spec.bleedIn,
          yIn: -spec.bleedIn,
          widthIn: 0.18 + spec.bleedIn,
          heightIn: H + 2 * spec.bleedIn,
          fill: COLORS.magenta,
        },
        contactBlock(W * 0.18, H * 0.30, W * 0.78, H * 0.07, COLORS.ink),
      ],
    };
    return [front, back];
  },
};

/* -------------------------------------------------------------------------- */
/* Template 3 — Stripes                                                       */
/* -------------------------------------------------------------------------- */

const stripes: TemplateDef = {
  id: "stripes",
  name: "Stripes",
  category: "bold-colorful",
  swatch: [COLORS.yellow, COLORS.magenta, COLORS.ink],
  supports: () => true,
  build(spec) {
    const W = spec.widthIn;
    const H = spec.heightIn;
    const bandH = H / 3;

    const front: TmplSide = {
      background: COLORS.paper,
      objects: [
        {
          kind: "rect",
          xIn: -spec.bleedIn,
          yIn: -spec.bleedIn,
          widthIn: W + 2 * spec.bleedIn,
          heightIn: bandH + spec.bleedIn,
          fill: COLORS.yellow,
        },
        {
          kind: "rect",
          xIn: -spec.bleedIn,
          yIn: bandH,
          widthIn: W + 2 * spec.bleedIn,
          heightIn: bandH,
          fill: COLORS.magenta,
        },
        {
          kind: "rect",
          xIn: -spec.bleedIn,
          yIn: bandH * 2,
          widthIn: W + 2 * spec.bleedIn,
          heightIn: bandH + spec.bleedIn,
          fill: COLORS.ink,
        },
        {
          kind: "text",
          xIn: 0,
          yIn: bandH + (bandH - H * 0.16) / 2,
          text: "Your Name",
          sizeIn: H * 0.14,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "bold",
          widthIn: W,
          textAlign: "center",
        },
      ],
    };

    if (spec.sides === 1) return [front];

    const back: TmplSide = {
      background: COLORS.ink,
      objects: [
        {
          kind: "text",
          xIn: 0,
          yIn: H * 0.40,
          text: "YOUR\nLOGO",
          sizeIn: H * 0.18,
          fill: COLORS.yellow,
          fontFamily: FONT.display,
          fontWeight: "900",
          widthIn: W,
          textAlign: "center",
        },
      ],
    };
    return [front, back];
  },
};

/* -------------------------------------------------------------------------- */
/* Template 4 — Spotlight                                                     */
/* -------------------------------------------------------------------------- */

const spotlight: TemplateDef = {
  id: "spotlight",
  name: "Spotlight",
  category: "bold-colorful",
  swatch: [COLORS.ink, COLORS.yellow],
  supports: (spec) => isLandscape(spec) || spec.heightIn / spec.widthIn < 1.4,
  build(spec) {
    const W = spec.widthIn;
    const H = spec.heightIn;
    const cr = Math.min(W, H) * 0.35;

    const front: TmplSide = {
      background: COLORS.ink,
      objects: [
        {
          kind: "circle",
          xIn: -cr * 0.4,
          yIn: H / 2 - cr,
          radiusIn: cr,
          fill: COLORS.yellow,
        },
        {
          kind: "text",
          xIn: cr * 1.3,
          yIn: H * 0.32,
          text: "Your Name",
          sizeIn: H * 0.13,
          fill: COLORS.paper,
          fontFamily: FONT.display,
          fontWeight: "bold",
          widthIn: W - cr * 1.4,
        },
        {
          kind: "text",
          xIn: cr * 1.3,
          yIn: H * 0.55,
          text: "Your Title · 555.555.1234",
          sizeIn: H * 0.06,
          fill: COLORS.paper,
          fontFamily: FONT.body,
          widthIn: W - cr * 1.4,
          opacity: 0.85,
        },
      ],
    };

    if (spec.sides === 1) return [front];

    const back: TmplSide = {
      background: COLORS.yellow,
      objects: [
        {
          kind: "text",
          xIn: 0,
          yIn: H * 0.42,
          text: "MAKE\nGOOD\nWORK",
          sizeIn: H * 0.16,
          fill: COLORS.ink,
          fontFamily: FONT.display,
          fontWeight: "900",
          widthIn: W,
          textAlign: "center",
        },
      ],
    };
    return [front, back];
  },
};

export const TEMPLATES: TemplateDef[] = [vividBlock, bigInitial, stripes, spotlight];

export function templatesFor(spec: ProductSpec): TemplateDef[] {
  return TEMPLATES.filter((t) => t.supports(spec));
}
