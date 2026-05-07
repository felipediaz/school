export default function DesignLayout({ children }: { children: React.ReactNode }) {
  // The editor owns the viewport on mobile so we strip the parent's
  // max-width / padding here.
  return <div className="-mx-6 -my-8 lg:-mx-0 lg:-my-0">{children}</div>;
}
