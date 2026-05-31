import Anthropic from "@anthropic-ai/sdk";

import type { ProductSpec } from "@/lib/products/specs";
import type { TmplObject, TmplSide } from "@/lib/templates/types";
import { PRINT_FONTS } from "@/lib/editor/fonts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const FONT_LIST = PRINT_FONTS.map((f) => f.family).join(", ");

/**
 * One static system prompt shared across every generation — kept first so
 * prompt caching can reuse it. Volatile per-request data (the user's
 * description and the product spec) goes into the user turn.
 */
const SYSTEM_PROMPT = `You are a senior print designer producing layouts for a print shop's online editor.

Your task is to read a customer's brief and emit a complete print-ready design via the \`create_design\` tool. The design must look intentional, professional and on-brief — not a generic placeholder.

# Output coordinate system

All positions and sizes are in **inches**, measured from the top-left of the **trim** (final cut) area. Negative coordinates extend into the bleed (allowed for full-bleed background blocks). The product's exact trim dimensions and bleed are passed in the user turn.

# Object kinds

Each object has a \`kind\` discriminator and the fields appropriate to that kind:

- **rect**: \`xIn\`, \`yIn\`, \`widthIn\`, \`heightIn\`, \`fill\` (hex). Use these for color blocks, accent strips, photo-frame placeholders.
- **circle**: \`xIn\`, \`yIn\`, \`radiusIn\`, \`fill\`. \`xIn\`/\`yIn\` is the bounding-box top-left, not the centre.
- **text**: \`xIn\`, \`yIn\`, \`text\`, \`sizeIn\` (font size in inches), \`fill\`, \`fontFamily\` (must be from the whitelist), optional \`fontWeight\` ("normal"|"bold"|"900"), optional \`textAlign\` ("left"|"center"|"right"), optional \`widthIn\` (textbox wrap width — set this for any text block longer than ~12 chars).
- **line**: \`xIn\`, \`yIn\`, \`dxIn\`, \`dyIn\` (endpoint relative to xIn/yIn), \`stroke\`, optional \`strokeWidthIn\`.

All objects optionally accept \`opacity\` in 0..1.

# Allowed fonts (whitelist)

${FONT_LIST}

Pick fonts that match the brief's tone. If unsure, default to Helvetica for sans, Georgia for serif.

# Print-design rules (non-negotiable)

1. **Bleed**: any background colour, photo, or block intended to reach the edge MUST extend to xIn = -bleedIn (and similarly on the other three sides). Use the product's \`bleedIn\` value.
2. **Safe zone**: keep ALL text and important graphics inside the safe area — at least \`safeIn\` inches from every trim edge. Text outside the safe zone risks being cut off.
3. **Sides**: produce 1 side for single-sided products and exactly 2 sides for double-sided products. The product spec specifies which.
4. **Realistic content**: when the customer doesn't supply names/numbers/email, invent plausible filler (e.g. "Maya Chen", "+1 555 010 2840", "hello@example.com") — do NOT leave \`{{placeholder}}\` markers.
5. **Hierarchy**: the most important text (a name, a headline) should be 2–4× the size of supporting copy. Pick \`sizeIn\` so the name uses ~10–18% of the trim height.
6. **Aesthetic discipline**: use 2–4 colours total. Reserve high-saturation colour for accents; ground the design with one strong neutral (white, paper-cream, or near-black). No more than 2 fonts unless the brief calls for it.
7. **Layout**: avoid centring everything. Use asymmetry, color blocking, scale contrast, and clear alignment. Avoid generic "logo + name centred" layouts unless the brief asks for them.

# Tool use

You MUST respond by calling the \`create_design\` tool exactly once. Do not include any conversational preamble. The tool's input is the full design.`;

const CREATE_DESIGN_TOOL: Anthropic.Tool = {
  name: "create_design",
  description: "Emit the complete print-ready design as TmplSide[] (front and optional back).",
  input_schema: {
    type: "object",
    properties: {
      sides: {
        type: "array",
        description: "One entry per side. Single-sided products = 1 entry; double-sided = 2.",
        items: {
          type: "object",
          properties: {
            background: {
              type: "string",
              description: "Hex color for the side's background (e.g. '#ffffff', '#0f172a').",
            },
            objects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["rect", "circle", "text", "line"] },
                  xIn: { type: "number" },
                  yIn: { type: "number" },
                  widthIn: { type: "number", description: "Required for rect; optional textbox wrap width for text." },
                  heightIn: { type: "number", description: "Required for rect." },
                  radiusIn: { type: "number", description: "Required for circle." },
                  text: { type: "string", description: "Required for text." },
                  sizeIn: { type: "number", description: "Required for text. Font size in inches." },
                  fontFamily: { type: "string", description: "Required for text. Must be in the whitelist." },
                  fontWeight: { type: "string", enum: ["normal", "bold", "900"] },
                  textAlign: { type: "string", enum: ["left", "center", "right"] },
                  fill: { type: "string", description: "Hex color. Required for rect/circle/text." },
                  stroke: { type: "string", description: "Hex color. Required for line." },
                  strokeWidthIn: { type: "number" },
                  dxIn: { type: "number", description: "Line endpoint X delta. Required for line." },
                  dyIn: { type: "number", description: "Line endpoint Y delta. Required for line." },
                  opacity: { type: "number", description: "0..1, default 1." },
                },
                required: ["kind", "xIn", "yIn"],
              },
            },
          },
          required: ["objects"],
        },
      },
    },
    required: ["sides"],
  },
};

interface AiSidesResult {
  sides: AiSide[];
}
interface AiSide {
  background?: string;
  objects: AiObject[];
}
interface AiObject {
  kind: "rect" | "circle" | "text" | "line";
  xIn: number;
  yIn: number;
  [key: string]: unknown;
}

let cachedClient: Anthropic | null = null;
function client(): Anthropic {
  if (!cachedClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    cachedClient = new Anthropic();
  }
  return cachedClient;
}

export async function generateDesign(
  prompt: string,
  spec: ProductSpec,
): Promise<TmplSide[]> {
  const userTurn = buildUserTurn(prompt, spec);

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [CREATE_DESIGN_TOOL],
    tool_choice: { type: "tool", name: "create_design" },
    messages: [{ role: "user", content: userTurn }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "create_design",
  );
  if (!toolUse) {
    throw new Error("AI did not return a create_design tool call");
  }

  const result = toolUse.input as AiSidesResult;
  return validateAndCoerce(result, spec);
}

function buildUserTurn(prompt: string, spec: ProductSpec): string {
  return [
    `Product: ${spec.label} (key: ${spec.key})`,
    `Trim: ${spec.widthIn}" wide × ${spec.heightIn}" tall`,
    `Bleed: ${spec.bleedIn}" on every side (extend backgrounds to xIn = -${spec.bleedIn})`,
    `Safe zone inset: ${spec.safeIn}" from every trim edge`,
    `Sides required: ${spec.sides}`,
    "",
    "Customer brief:",
    prompt.trim(),
  ].join("\n");
}

function validateAndCoerce(input: AiSidesResult, spec: ProductSpec): TmplSide[] {
  if (!input?.sides || !Array.isArray(input.sides)) {
    throw new Error("AI returned no sides");
  }
  if (input.sides.length === 0) {
    throw new Error("AI returned an empty sides array");
  }

  const sides: TmplSide[] = input.sides.slice(0, spec.sides).map((s) => ({
    background: typeof s.background === "string" ? s.background : "#ffffff",
    objects: (s.objects ?? []).map(coerceObject).filter((x): x is TmplObject => x !== null),
  }));
  // If AI under-delivers (single side for a double-sided product), pad with a blank back.
  while (sides.length < spec.sides) {
    sides.push({ background: "#ffffff", objects: [] });
  }
  return sides;
}

function coerceObject(o: AiObject): TmplObject | null {
  const xIn = num(o.xIn);
  const yIn = num(o.yIn);
  if (xIn === null || yIn === null) return null;
  const opacity = optionalNum(o.opacity);
  switch (o.kind) {
    case "rect": {
      const widthIn = num(o.widthIn);
      const heightIn = num(o.heightIn);
      const fill = str(o.fill);
      if (widthIn === null || heightIn === null || !fill) return null;
      return { kind: "rect", xIn, yIn, widthIn, heightIn, fill, opacity };
    }
    case "circle": {
      const radiusIn = num(o.radiusIn);
      const fill = str(o.fill);
      if (radiusIn === null || !fill) return null;
      return { kind: "circle", xIn, yIn, radiusIn, fill, opacity };
    }
    case "text": {
      const text = str(o.text);
      const sizeIn = num(o.sizeIn);
      const fill = str(o.fill);
      const fontFamily = str(o.fontFamily) || "Helvetica";
      if (!text || sizeIn === null || !fill) return null;
      return {
        kind: "text",
        xIn,
        yIn,
        text,
        sizeIn,
        fill,
        fontFamily,
        fontWeight: pickWeight(o.fontWeight),
        textAlign: pickAlign(o.textAlign),
        widthIn: optionalNum(o.widthIn) ?? undefined,
        opacity,
      };
    }
    case "line": {
      const dxIn = num(o.dxIn);
      const dyIn = num(o.dyIn);
      const stroke = str(o.stroke) || str(o.fill);
      if (dxIn === null || dyIn === null || !stroke) return null;
      return {
        kind: "line",
        xIn,
        yIn,
        dxIn,
        dyIn,
        stroke,
        strokeWidthIn: optionalNum(o.strokeWidthIn) ?? undefined,
        opacity,
      };
    }
    default:
      return null;
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function optionalNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function pickWeight(v: unknown): "normal" | "bold" | "900" | undefined {
  return v === "bold" || v === "900" || v === "normal" ? v : undefined;
}
function pickAlign(v: unknown): "left" | "center" | "right" | undefined {
  return v === "left" || v === "center" || v === "right" ? v : undefined;
}
