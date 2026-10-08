/**
 * The rule `scripts/validate-markdown-alternates.ts` enforces against dist/:
 * every markdown copy a page advertises exists, and names that page as its
 * canonical, so agents never follow our link into a 404 and search engines
 * never treat the copy as a second page.
 */
import { parse } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'

export interface BuiltPage {
  /** `/cli/`, `/zh-CN/about/`, `/` */
  route: string
  html: string
}

export interface MarkdownAlternateReport {
  advertised: number
  /** Advertising pages with a `rel="canonical"` to compare the twin's against. */
  canonicalChecked: number
  problems: string[]
}

/**
 * 855 of 950 built pages (90%) advertise a copy today; the rest are noindex,
 * redirect or empty pages. 80% leaves room for ~95 more of those, and fails
 * when any large family (149 /hub/models, 158 zh-CN, 383 supported-models)
 * loses its link.
 */
const MIN_ADVERTISED_SHARE = 0.8

const FRONT_MATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/
const CANONICAL_FIELD = /^canonical:\s*(\S+)\s*$/m

type Attributes = Map<string, string>

function linkElements(node: DefaultTreeAdapterTypes.ParentNode): Attributes[] {
  return node.childNodes.flatMap((child) => {
    if (!('tagName' in child)) return []
    const nested = linkElements(child)
    if (child.tagName !== 'link') return nested
    const attributes = new Map(
      child.attrs.map(({ name, value }) => [name, value])
    )
    return [attributes, ...nested]
  })
}

function hasRel(link: Attributes, rel: string): boolean {
  return (link.get('rel') ?? '').toLowerCase().split(/\s+/).includes(rel)
}

function isMarkdownAlternate(link: Attributes): boolean {
  return (
    hasRel(link, 'alternate') &&
    link.get('type')?.trim().toLowerCase() === 'text/markdown'
  )
}

function twinCanonical(markdown: string): string | undefined {
  const front = FRONT_MATTER.exec(markdown.replace(/\r\n/g, '\n'))?.[1]
  return front === undefined ? undefined : CANONICAL_FIELD.exec(front)?.[1]
}

function twinPath(
  href: string,
  base: string,
  origin: string
): { path: string } | { problem: string } {
  try {
    const url = new URL(href, base)
    if (url.origin !== origin)
      return { problem: `advertises ${href}, which is not on ${origin}` }
    return { path: decodeURI(url.pathname) }
  } catch {
    return { problem: `advertises ${href}, which is not a valid URL` }
  }
}

function pageProblem(
  { route, html }: BuiltPage,
  readTwin: (path: string) => string | undefined,
  origin: string
): { advertises: boolean; canonicalChecked?: boolean; problem?: string } {
  const links = linkElements(parse(html))
  const alternate = links.find(isMarkdownAlternate)
  if (alternate === undefined) return { advertises: false }
  const href = alternate.get('href')
  if (!href) {
    return {
      advertises: true,
      problem: `${route}: has a text/markdown link with no readable href`
    }
  }
  const resolved = twinPath(href, `${origin}${route}`, origin)
  if ('problem' in resolved)
    return { advertises: true, problem: `${route}: ${resolved.problem}` }
  const { path } = resolved
  const twin = readTwin(path)
  if (twin === undefined) {
    return {
      advertises: true,
      problem: `${route}: advertises ${path}, which was not built`
    }
  }
  const actual = twinCanonical(twin)
  if (actual === undefined) {
    return {
      advertises: true,
      problem: `${route}: ${path} has no canonical in its front matter`
    }
  }
  const expected = links.find((link) => hasRel(link, 'canonical'))?.get('href')
  if (expected === undefined) return { advertises: true }
  return {
    advertises: true,
    canonicalChecked: true,
    problem:
      actual === expected
        ? undefined
        : `${route}: ${path} names canonical ${actual}, the page says ${expected}`
  }
}

/**
 * One problem per page whose advertised markdown copy has an unreadable href,
 * is missing, has no `canonical:` front matter, or names a different page than
 * the HTML does. A page without `rel="canonical"` (every page of a
 * non-indexable build) has nothing to compare against, so only its copy's
 * existence is checked. `readTwin` returns the twin's text, or undefined when
 * no such file was built.
 */
export function auditMarkdownAlternates(
  pages: readonly BuiltPage[],
  readTwin: (path: string) => string | undefined,
  origin: string
): MarkdownAlternateReport {
  const results = pages.map((page) => pageProblem(page, readTwin, origin))
  return {
    advertised: results.filter((result) => result.advertises).length,
    canonicalChecked: results.filter((result) => result.canonicalChecked)
      .length,
    problems: results.flatMap((result) =>
      result.problem === undefined ? [] : [result.problem]
    )
  }
}

/** Why too few built pages advertise a markdown copy, or undefined. */
export function advertisementShortfall(
  advertised: number,
  builtPages: number
): string | undefined {
  const required = Math.max(1, Math.ceil(builtPages * MIN_ADVERTISED_SHARE))
  if (advertised >= required) return undefined
  return (
    `only ${advertised} of ${builtPages} built pages advertise a markdown copy; ` +
    `at least ${required} (${MIN_ADVERTISED_SHARE * 100}%) must. Pages lost ` +
    'their <link rel="alternate" type="text/markdown">, or the build is incomplete.'
  )
}
