import { NextRequest, NextResponse } from "next/server";
import { saveUpload } from "@/lib/storage/fs";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]);

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const { relPath } = await saveUpload(file.name, bytes);
  return NextResponse.json({
    path: relPath,
    url: `/api/uploads/${encodeURIComponent(relPath)}`,
    width: null,
    height: null,
  });
}
