import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";

/**
 * Reads the markdown in /docs and renders it for the site.
 *
 * The files stay plain markdown at the repo root so they are readable on
 * GitHub and editable without touching the app. Next has to be told to bundle
 * them for production; see `outputFileTracingIncludes` in next.config.ts.
 */

export interface DocMeta {
  slug: string;
  title: string;
  summary: string;
  order: number;
}

/** One entry in the "on this page" rail. */
export interface Heading {
  id: string;
  text: string;
  depth: number;
}

export interface Doc extends DocMeta {
  html: string;
  headings: Heading[];
}

/** The overview lives at /docs itself rather than /docs/overview. */
export const OVERVIEW_SLUG = "overview";

export function docHref(slug: string) {
  return slug === OVERVIEW_SLUG ? "/docs" : `/docs/${slug}`;
}

const DOCS_DIR = path.join(process.cwd(), "docs");

/**
 * Minimal frontmatter reader. A YAML parser would be a dependency for three
 * string fields we control ourselves.
 */
function splitFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };

  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };

  const head = raw.slice(3, end);
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");

  const meta: Record<string, string> = {};
  for (const line of head.split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body };
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function readDoc(file: string): Promise<Doc | null> {
  try {
    const raw = await fs.readFile(path.join(DOCS_DIR, file), "utf8");
    const slug = file.replace(/\.md$/i, "");
    const { meta, body } = splitFrontmatter(raw);

    // Headings get ids so they can be linked to directly, and are collected
    // for the on-page contents rail.
    const headings: Heading[] = [];
    const renderer = new marked.Renderer();
    renderer.heading = function ({ tokens, text, depth }) {
      // Headings here contain code spans and links, so the inline tokens have
      // to be parsed. Using the raw `text` would print the backticks.
      const inner = this.parser.parseInline(tokens);
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      // h1 is the page title and is already rendered as the header; h4 and
      // deeper is too granular to navigate by.
      if (depth === 2 || depth === 3) {
        headings.push({ id, text: text.replace(/`/g, ""), depth });
      }
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    };

    // Cross-doc links are written as "./usage.md" so they work on GitHub.
    // On the site the route is /docs/usage, so rewrite them here rather than
    // making the markdown correct in one place and broken in the other.
    const baseLink = renderer.link.bind(renderer);
    renderer.link = (token) => {
      const href = token.href ?? "";
      const local = /^(?:\.\/|\.\.\/)?([a-z0-9-]+)\.md(#.*)?$/i.exec(href);
      if (local) {
        return baseLink({
          ...token,
          href: `/docs/${local[1].toLowerCase()}${local[2] ?? ""}`,
        });
      }
      const html = baseLink(token);
      // Anything off-site opens in a new tab; noreferrer because some of these
      // are third-party services and the referrer leaks the claim id.
      return /^https?:\/\//i.test(href)
        ? html.replace("<a ", '<a target="_blank" rel="noopener noreferrer" ')
        : html;
    };

    // Tables in these docs are wider than a phone. Wrap each one so it scrolls
    // inside itself instead of forcing the whole page sideways.
    const baseTable = renderer.table.bind(renderer);
    renderer.table = (token) =>
      `<div class="table-scroll">${baseTable(token)}</div>`;

    const html = await marked.parse(body, {
      renderer,
      gfm: true,
      breaks: false,
    });

    return {
      slug,
      title: meta.title || titleFromSlug(slug),
      summary: meta.summary || "",
      order: Number(meta.order ?? 99),
      html,
      headings,
    };
  } catch {
    return null;
  }
}

export async function listDocs(): Promise<DocMeta[]> {
  try {
    const files = (await fs.readdir(DOCS_DIR)).filter((f) =>
      f.toLowerCase().endsWith(".md")
    );
    const docs = await Promise.all(files.map(readDoc));
    return docs
      .filter((d): d is Doc => d !== null)
      .map(({ slug, title, summary, order }) => ({
        slug,
        title,
        summary,
        order,
      }))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

export async function getDoc(slug: string): Promise<Doc | null> {
  // Never let a URL segment escape the docs directory.
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  return readDoc(`${slug}.md`);
}
