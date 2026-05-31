import { notFound } from "next/navigation";
import { getProductSpec } from "@/lib/products/specs";
import Editor from "./Editor.client";

export default async function DesignPage({ params, searchParams }: {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ design?: string }>;
}) {
  const { product } = await params;
  const { design } = await searchParams;
  const spec = getProductSpec(product);
  if (!spec) notFound();

  return <Editor spec={spec} initialDesignId={design ?? null} />;
}
