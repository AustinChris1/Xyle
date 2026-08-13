import Link from "next/link";
import type { Doc, DocMeta } from "@/lib/docs";
import { docHref } from "@/lib/docs";
import { ArrowLeftIcon, ArrowRightIcon } from "./Icon";

/**
 * One rendered document: contents rail, prose, and prev/next.
 *
 * Shared by /docs (the overview) and /docs/[slug] so both pages are laid out
 * identically and only the source file differs.
 */
export function DocArticle({ doc, all }: { doc: Doc; all: DocMeta[] }) {
  const index = all.findIndex((d) => d.slug === doc.slug);
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  return (
    <div className="xl:flex xl:gap-10">
      <article className="min-w-0 flex-1">
        {doc.summary && (
          <p className="mb-6 border-l-2 border-signal bg-sunken px-4 py-3 text-sm text-muted">
            {doc.summary}
          </p>
        )}

        <div className="doc-prose" dangerouslySetInnerHTML={{ __html: doc.html }} />

        {(prev || next) && (
          <nav className="mt-16 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={docHref(prev.slug)}
                className="group border border-line p-4 transition-colors hover:border-signal"
              >
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  <ArrowLeftIcon size={12} /> Previous
                </span>
                <span className="mt-1 block text-sm text-ink transition-colors group-hover:text-signal">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link
                href={docHref(next.slug)}
                className="group border border-line p-4 text-right transition-colors hover:border-signal sm:col-start-2"
              >
                <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  Next <ArrowRightIcon size={12} />
                </span>
                <span className="mt-1 block text-sm text-ink transition-colors group-hover:text-signal">
                  {next.title}
                </span>
              </Link>
            )}
          </nav>
        )}
      </article>

      {/* Contents rail. Only worth the space when there is enough to navigate
          and a viewport wide enough not to steal it from the prose. */}
      {doc.headings.length > 2 && (
        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-24">
            <p className="section-rule mb-3">On this page</p>
            <ul className="space-y-1">
              {doc.headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={`block py-1 text-[13px] leading-snug text-muted transition-colors hover:text-signal ${
                      h.depth === 3 ? "pl-3 text-faint" : ""
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
