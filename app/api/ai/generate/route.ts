import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getProductSpec } from "@/lib/products/specs";
import { generateDesign } from "@/lib/ai/designGenerator";
import { tmplSidesToFabricSides } from "@/lib/templates/apply";

export const runtime = "nodejs";
// Generation can take 5–15s on Sonnet 4.6; keep the platform happy.
export const maxDuration = 60;

const Body = z.object({
  prompt: z.string().min(3).max(2000),
  productKey: z.string(),
  ppi: z.number().positive().max(600),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { prompt, productKey, ppi } = parsed.data;
  const spec = getProductSpec(productKey);
  if (!spec) {
    return NextResponse.json({ error: "unknown productKey" }, { status: 400 });
  }

  try {
    const sides = await generateDesign(prompt, spec);
    const fabricSides = tmplSidesToFabricSides(sides, spec, ppi);
    return NextResponse.json({ sides: fabricSides });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY invalid or missing" }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited — try again in a moment" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
