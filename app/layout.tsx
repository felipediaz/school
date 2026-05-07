import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Printshop Designer",
  description:
    "Design business cards, postcards, envelopes and flyers, then order through our shop.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow user pinch-zoom on browse pages; the editor manages its own
  // canvas-level pinch and prevents page-level pinch over the artwork.
  maximumScale: 5,
  themeColor: "#fafaf7",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-ink/10 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Printshop Designer
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Products
              </Link>
              <Link href="/cart" className="hover:underline">
                Cart
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-ink/10 py-6 text-center text-xs text-ink/60">
          © {new Date().getFullYear()} Printshop Designer
        </footer>
      </body>
    </html>
  );
}
