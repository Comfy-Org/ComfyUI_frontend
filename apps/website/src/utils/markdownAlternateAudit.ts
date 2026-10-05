/**
 * The rule `scripts/validate-markdown-alternates.ts` enforces against dist/:
 * every markdown copy a page advertises exists, and names that page as its
 * canonical, so agents never follow our link into a 404 and search engines
 * never treat the copy as a second page.
 */

export interface BuiltPage {
  /** `/cli/`, `/zh-CN/about/`, `/` */
  route: string
  html: string
}

const MARKDOWN_ALTERNATE = /<link\b[^>]*\btype="text\/markdown"[^>]*>/i
const HREF = /\bhref="([^"]*)"/i
const CANONICAL =
  /<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]*)"[^>]*>/i
const FRONT_MATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/
const CANONICAL_FIELD = /^canonical:\s*(\S+)\s*$/m

function markdownAlternateHref(html: string): string | undefined {
  const link = MARKDOWN_ALTERNATE.exec(html)?.[0]
  return link === undefined ? undefined : HREF.exec(link)?.[1]
}

function htmlCanonical(html: string): string | undefined {
  return CANONICAL.exec(html)?.[1]
}

function twinCanonical(markdown: string): string | undefined {
  const front = FRONT_MATTER.exec(markdown.replace(/\r\n/g, '\n'))?.[1]
  return front === undefined ? undefined : CANONICAL_FIELD.exec(front)?.[1]
}

/**
 * One problem per page that advertises a markdown copy that is missing, has no
 * `canonical:` front matter, or names a different page than the HTML does.
 * `readTwin` returns the twin's text, or undefined when no such file was built.
 */
export function auditMarkdownAlternates(
  pages: readonly BuiltPage[],
  readTwin: (path: string) => string | undefined,
  origin: string
): { advertised: number; problems: string[] } {
  let advertised = 0
  const problems: string[] = []
  for (const { route, html } of pages) {
    const href = markdownAlternateHref(html)
    if (href === undefined) continue
    advertised++
    const path = decodeURI(new URL(href, `${origin}${route}`).pathname)
    const twin = readTwin(path)
    if (twin === undefined) {
      problems.push(`${route}: advertises ${path}, which was not built`)
      continue
    }
    const expected = htmlCanonical(html) ?? new URL(route, origin).href
    const actual = twinCanonical(twin)
    if (actual === undefined) {
      problems.push(`${route}: ${path} has no canonical in its front matter`)
    } else if (actual !== expected) {
      problems.push(
        `${route}: ${path} names canonical ${actual}, the page says ${expected}`
      )
    }
  }
  return { advertised, problems }
}
