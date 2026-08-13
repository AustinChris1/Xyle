import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OVERVIEW_SLUG, getDoc, listDocs } from "@/lib/docs";
import { DocArticle } from "@/components/DocArticle";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.title, description: doc.summary };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The overview is served at /docs. Redirect so the same content is not
  // reachable at two URLs.
  if (slug === OVERVIEW_SLUG) redirect("/docs");

  const [doc, all] = await Promise.all([getDoc(slug), listDocs()]);
  if (!doc) notFound();

  return <DocArticle doc={doc} all={all} />;
}
