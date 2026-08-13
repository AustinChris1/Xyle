import { docHref, listDocs } from "@/lib/docs";
import { DocsShell } from "@/components/DocsShell";

export const dynamic = "force-dynamic";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = await listDocs();
  return (
    <DocsShell docs={docs.map((d) => ({ ...d, href: docHref(d.slug) }))}>
      {children}
    </DocsShell>
  );
}
