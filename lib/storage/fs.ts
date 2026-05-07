import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Storage root. On long-lived hosts (Opalstack, a VPS) this is a writable
 * directory under the project. On Vercel/serverless, the function filesystem
 * is read-only except for `/tmp`; we fall back there so previews work, with
 * the caveat that uploads & rendered PDFs don't survive across invocations.
 */
const DEFAULT_ROOT = process.env.VERCEL ? "/tmp/printshop" : "./storage";
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT ?? DEFAULT_ROOT);

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function safeJoin(...parts: string[]): string {
  const joined = path.join(STORAGE_ROOT, ...parts);
  const resolved = path.resolve(joined);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error("path escapes STORAGE_ROOT");
  }
  return resolved;
}

export async function saveUpload(
  filename: string,
  bytes: Buffer | Uint8Array,
): Promise<{ relPath: string; absPath: string }> {
  const ext = path.extname(filename).toLowerCase().slice(0, 8) || ".bin";
  const id = crypto.randomBytes(12).toString("hex");
  const relPath = path.posix.join("uploads", `${id}${ext}`);
  const absPath = safeJoin(relPath);
  await ensureDir(path.dirname(absPath));
  await fs.writeFile(absPath, bytes);
  return { relPath, absPath };
}

export async function saveOrderPdf(
  orderNo: string,
  lineItemId: string,
  side: number,
  pdf: Uint8Array,
): Promise<string> {
  const rel = path.posix.join("orders", orderNo, `${lineItemId}-side${side + 1}.pdf`);
  const abs = safeJoin(rel);
  await ensureDir(path.dirname(abs));
  await fs.writeFile(abs, pdf);
  return rel;
}

export async function copyToOutbox(orderNo: string, relPath: string): Promise<string> {
  const src = safeJoin(relPath);
  const destRel = path.posix.join("outbox", orderNo, path.basename(relPath));
  const dest = safeJoin(destRel);
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
  return destRel;
}

export async function readStored(relPath: string): Promise<Buffer> {
  return fs.readFile(safeJoin(relPath));
}

export function absoluteFor(relPath: string): string {
  return safeJoin(relPath);
}

export function relativeFor(filename: string, scope: "uploads" | "test" = "uploads"): string {
  return path.posix.join(scope, filename);
}

export { STORAGE_ROOT };
