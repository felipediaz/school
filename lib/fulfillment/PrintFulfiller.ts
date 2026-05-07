/**
 * Abstract submission target for finished print jobs. v1 ships with a
 * filesystem `StubFulfiller` (writes to storage/outbox/) and a
 * `ZooSftpFulfiller` that uploads via SFTP. The webhook handler talks to this
 * interface so the concrete target is swappable via the FULFILLER env var.
 */
export interface PrintJobLineItem {
  /** Shopify line-item id, used as the unique filename prefix on the remote. */
  shopifyLineId: string;
  productKey: string;
  quantity: number;
  paper?: string | null;
  /** Storage-relative paths to the rendered PDF(s) for this line. */
  pdfPaths: string[];
}

export interface PrintJob {
  /** Shopify human-readable order number, used as the remote subdirectory. */
  orderNumber: string;
  email?: string;
  items: PrintJobLineItem[];
}

export interface SubmitResult {
  ok: boolean;
  detail: string;
  /** Remote paths or local copies actually written. */
  artifacts: string[];
}

export interface PrintFulfiller {
  readonly id: string;
  submit(job: PrintJob): Promise<SubmitResult>;
}

let cached: PrintFulfiller | null = null;

export async function getFulfiller(): Promise<PrintFulfiller> {
  if (cached) return cached;
  const choice = (process.env.FULFILLER ?? "stub").toLowerCase();
  if (choice === "zoo") {
    const { ZooSftpFulfiller } = await import("./ZooSftpFulfiller");
    cached = new ZooSftpFulfiller();
  } else {
    const { StubFulfiller } = await import("./StubFulfiller");
    cached = new StubFulfiller();
  }
  return cached;
}
