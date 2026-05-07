/**
 * Whitelist of fonts the editor exposes. Kept short and deliberately
 * print-safe — only families with reliable cross-platform metrics are
 * included so PDF rendering matches the on-screen layout.
 */
export interface PrintFont {
  family: string;
  cssStack: string;
  category: "sans" | "serif" | "mono" | "display";
}

export const PRINT_FONTS: PrintFont[] = [
  { family: "Inter", cssStack: "Inter, system-ui, sans-serif", category: "sans" },
  { family: "Helvetica", cssStack: "Helvetica, Arial, sans-serif", category: "sans" },
  { family: "Arial", cssStack: "Arial, Helvetica, sans-serif", category: "sans" },
  { family: "Georgia", cssStack: "Georgia, 'Times New Roman', serif", category: "serif" },
  { family: "Times New Roman", cssStack: "'Times New Roman', Times, serif", category: "serif" },
  { family: "Courier New", cssStack: "'Courier New', Courier, monospace", category: "mono" },
  { family: "Impact", cssStack: "Impact, 'Arial Black', sans-serif", category: "display" },
];

export const DEFAULT_FONT = PRINT_FONTS[0];
