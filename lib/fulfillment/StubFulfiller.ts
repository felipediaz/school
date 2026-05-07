import path from "node:path";
import { promises as fs } from "node:fs";

import { absoluteFor } from "@/lib/storage/fs";
import type { PrintFulfiller, PrintJob, SubmitResult } from "./PrintFulfiller";

/**
 * Local-only fulfiller. Copies generated PDFs to `storage/outbox/<orderNo>/`
 * so a developer or operator can verify the artwork before flipping the
 * FULFILLER env var to `zoo`.
 */
export class StubFulfiller implements PrintFulfiller {
  readonly id = "stub";

  async submit(job: PrintJob): Promise<SubmitResult> {
    const artifacts: string[] = [];
    const baseAbs = absoluteFor(path.posix.join("outbox", job.orderNumber));
    await fs.mkdir(baseAbs, { recursive: true });
    for (const item of job.items) {
      for (const rel of item.pdfPaths) {
        const src = absoluteFor(rel);
        const dest = path.join(baseAbs, path.basename(rel));
        await fs.copyFile(src, dest);
        artifacts.push(path.posix.join("outbox", job.orderNumber, path.basename(rel)));
      }
    }
    return {
      ok: true,
      detail: `Copied ${artifacts.length} file(s) to local outbox`,
      artifacts,
    };
  }
}
