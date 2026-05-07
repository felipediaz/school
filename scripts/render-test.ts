/**
 * Quick CLI to verify PDF rendering for a saved design.
 *
 *   npm run render-test -- <designId>
 *
 * Writes the PDF to storage/test/<designId>.pdf
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/db";
import { getProductSpec } from "../lib/products/specs";
import { isDesignDocument } from "../lib/editor/serialize";
import { renderDesignPdf } from "../lib/pdf/render";
import { absoluteFor } from "../lib/storage/fs";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: npm run render-test -- <designId>");
    process.exit(1);
  }
  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) throw new Error(`design ${id} not found`);
  const spec = getProductSpec(design.productKey);
  if (!spec) throw new Error(`no spec for ${design.productKey}`);
  if (!isDesignDocument(design.data)) throw new Error("invalid design data");

  const pdf = await renderDesignPdf(design.data, spec);
  const rel = path.posix.join("test", `${id}.pdf`);
  const abs = absoluteFor(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, pdf);
  console.log(`wrote ${abs} (${pdf.byteLength} bytes)`);
}

main().then(
  () => prisma.$disconnect(),
  (err) => {
    console.error(err);
    void prisma.$disconnect();
    process.exit(1);
  },
);
