import path from "node:path";
import { promises as fs } from "node:fs";

import { absoluteFor } from "@/lib/storage/fs";
import type { PrintFulfiller, PrintJob, SubmitResult } from "./PrintFulfiller";

/**
 * ZooPrinting SFTP drop.
 *
 * STATUS: STUBBED. The wire-up (env vars, SFTP client, file iteration) is
 * complete, but the exact remote naming convention + any required job ticket
 * / CSV manifest will need to come from ZooPrinting before going live.
 *
 * To activate:
 *   1. Set FULFILLER=zoo
 *   2. Fill ZOO_SFTP_HOST / USER / (PASSWORD or KEY_PATH) / REMOTE_DIR
 *   3. Confirm naming convention with ZooPrinting and update `remoteName()`
 *      below if needed.
 */
export class ZooSftpFulfiller implements PrintFulfiller {
  readonly id = "zoo";

  async submit(job: PrintJob): Promise<SubmitResult> {
    const host = process.env.ZOO_SFTP_HOST;
    const user = process.env.ZOO_SFTP_USER;
    const remoteDir = process.env.ZOO_SFTP_REMOTE_DIR ?? "/incoming";
    if (!host || !user) {
      return {
        ok: false,
        detail: "ZOO_SFTP_HOST / ZOO_SFTP_USER not configured",
        artifacts: [],
      };
    }

    const port = Number(process.env.ZOO_SFTP_PORT ?? 22);
    const password = process.env.ZOO_SFTP_PASSWORD || undefined;
    const keyPath = process.env.ZOO_SFTP_KEY_PATH || undefined;

    // Lazy import so this native dep doesn't load in dev when FULFILLER=stub.
    const SftpClient = (await import("ssh2-sftp-client")).default;
    const sftp = new SftpClient();
    const artifacts: string[] = [];

    try {
      await sftp.connect({
        host,
        port,
        username: user,
        password,
        privateKey: keyPath ? await fs.readFile(keyPath) : undefined,
      });

      const remoteOrderDir = path.posix.join(remoteDir, job.orderNumber);
      const exists = await sftp.exists(remoteOrderDir);
      if (!exists) await sftp.mkdir(remoteOrderDir, true);

      for (const item of job.items) {
        for (const rel of item.pdfPaths) {
          const localAbs = absoluteFor(rel);
          const remoteName = this.remoteName(job, item, path.basename(rel));
          const remotePath = path.posix.join(remoteOrderDir, remoteName);
          await sftp.fastPut(localAbs, remotePath);
          artifacts.push(remotePath);
        }
      }
    } finally {
      try {
        await sftp.end();
      } catch {
        /* swallow close errors */
      }
    }

    return {
      ok: true,
      detail: `Uploaded ${artifacts.length} file(s) to ${host}`,
      artifacts,
    };
  }

  /**
   * Naming convention placeholder. ZooPrinting historically uses
   * `<order>-<lineId>-<side>.pdf`; confirm before going live.
   */
  private remoteName(job: PrintJob, item: { shopifyLineId: string; productKey: string }, base: string): string {
    return `${job.orderNumber}__${item.productKey}__${item.shopifyLineId}__${base}`;
  }
}
