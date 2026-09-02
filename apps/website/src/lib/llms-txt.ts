const LINK_LINE =
  /^- \[(?<title>[^\]]+)\]\((?<url>https?:\/\/[^)\s]+)\): (?<description>.+)$/

export interface LlmsTxtLink {
  title: string
  url: string
  description: string
}

/** Parse every `- [title](url): description` bullet out of an llms.txt body. */
export function parseLlmsTxtLinks(llmsTxt: string): LlmsTxtLink[] {
  return llmsTxt
    .split('\n')
    .map((line) => LINK_LINE.exec(line)?.groups)
    .filter(
      (groups): groups is Record<'title' | 'url' | 'description', string> =>
        Boolean(groups)
    )
    .map(({ title, url, description }) => ({ title, url, description }))
}

/** Whether a line is a well-formed `- [title](url): description` bullet. */
export function isLlmsTxtLinkLine(line: string): boolean {
  return LINK_LINE.test(line)
}

/** Drop a trailing slash so `/foo/` and `/foo` compare equal; keep `/` as `/`. */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** The comfy.org-hosted links, as normalized pathnames paired with their source link. */
export function internalLinks(
  links: LlmsTxtLink[],
  hostname = 'comfy.org'
): { path: string; link: LlmsTxtLink }[] {
  return links
    .map((link) => ({ link, url: new URL(link.url) }))
    .filter(({ url }) => url.hostname === hostname)
    .map(({ link, url }) => ({ path: normalizePath(url.pathname), link }))
}

/**
 * llms.txt links whose path is itself a redirect source (e.g. a Vercel edge
 * redirect). Linking a redirect source instead of its destination means an
 * agent following the link pays an extra hop, and the description sitting
 * next to it describes whatever page the redirect used to point at.
 */
export function findRedirectedLinks(
  links: LlmsTxtLink[],
  redirectSources: ReadonlySet<string>
): LlmsTxtLink[] {
  return internalLinks(links)
    .filter(({ path }) => redirectSources.has(path))
    .map(({ link }) => link)
}

interface CanonicalDrift {
  link: LlmsTxtLink
  canonical: string
}

export interface CanonicalDriftResult {
  drift: CanonicalDrift[]
  /** Links whose built page had a canonical to compare against. */
  checked: number
}

/**
 * llms.txt links whose built page resolves to a different canonical URL - an
 * Astro-level redirect (a renamed or merged page) that vercel.json does not
 * know about. `canonicalFor` looks up a built page's own `rel="canonical"`
 * href by pathname; a path with no built page (an external site's route
 * shape, e.g. the Comfy Workflows app) is skipped, matching the existing
 * coverage test's handling of those routes. `checked` counts only links that
 * were actually compared, so a caller can detect a vacuous pass (e.g. every
 * link skipped because `dist/` was never built).
 */
export function findCanonicalDrift(
  links: LlmsTxtLink[],
  canonicalFor: (path: string) => string | undefined
): CanonicalDriftResult {
  const drift: CanonicalDrift[] = []
  let checked = 0
  for (const { path, link } of internalLinks(links)) {
    const canonical = canonicalFor(path)
    if (canonical === undefined) continue
    checked++
    const canonicalUrl = new URL(canonical)
    const linkUrl = new URL(link.url)
    if (
      canonicalUrl.origin !== linkUrl.origin ||
      normalizePath(canonicalUrl.pathname) !== path
    ) {
      drift.push({ link, canonical })
    }
  }
  return { drift, checked }
}
