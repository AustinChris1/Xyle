import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OVERVIEW_SLUG, getDoc, listDocs } from "@/lib/docs";
import { DocArticle } from "@/components/DocArticle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "What Xyle is, how it works, how to use each page, and the architecture underneath.",
};

/** /docs is the overview itself, not an index of links to read first. */
export default async function DocsIndex() {
  const [doc, all] = await Promise.all([getDoc(OVERVIEW_SLUG), listDocs()]);
  if (!doc) notFound();
  return <DocArticle doc={doc} all={all} />;
}
