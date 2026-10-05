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
 * A Vercel redirect source as a matcher for a normalized pathname: literal
 * sources plus the `:slug`, `:path+` and `/:path*` params Vercel accepts.
 */
export function redirectSourcePattern(source: string): RegExp {
  const pattern = normalizePath(source)
    .split(/(\/:\w+\*|:\w+\+|:\w+)/)
    .map((part, index) => {
      if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (part.endsWith('*')) return '(?:/.*)?'
      if (part.endsWith('+')) return '.+'
      return '[^/]+'
    })
    .join('')
  return new RegExp(`^${pattern}$`)
}

/**
 * llms.txt links whose path matches a redirect source (e.g. a Vercel edge
 * redirect). Linking a redirect source instead of its destination means an
 * agent following the link pays an extra hop, and the description sitting
 * next to it describes whatever page the redirect used to point at.
 */
export function findRedirectedLinks(
  links: LlmsTxtLink[],
  redirectSources: readonly string[]
): LlmsTxtLink[] {
  const patterns = redirectSources.map(redirectSourcePattern)
  return internalLinks(links)
    .filter(({ path }) => patterns.some((pattern) => pattern.test(path)))
    .map(({ link }) => link)
}

/**
 * Route shapes of the Comfy Workflows app, which lives in another repo and is
 * served behind the comfy.org router. Only these shapes may be linked; the
 * slugs themselves are verified against the live site, not here.
 */
const WORKFLOWS_APP_ROUTES = [
  /^\/workflows$/,
  /^\/workflows\/creators$/,
  /^\/workflows\/category\/[a-z0-9-]+$/,
  /^\/workflows\/model(\/[a-z0-9-]+)?$/,
  /^\/workflows\/use-cases(\/[a-z0-9-]+)?$/,
  /^\/[a-z]{2}(-[A-Za-z]{2})?\/workflows$/
]

/** Whether a normalized pathname is a Comfy Workflows app page, not this site's. */
export function isWorkflowsAppPath(path: string): boolean {
  return WORKFLOWS_APP_ROUTES.some((route) => route.test(path))
}

/** comfy.org links whose path neither the build nor another app behind the router serves. */
export function findMissingLinks(
  links: LlmsTxtLink[],
  isServed: (path: string) => boolean
): LlmsTxtLink[] {
  return internalLinks(links)
    .filter(({ path }) => !isServed(path))
    .map(({ link }) => link)
}

export interface CanonicalDrift {
  link: LlmsTxtLink
  canonical: string
}

/**
 * llms.txt links whose built page resolves to a different canonical URL - an
 * Astro-level redirect (a renamed or merged page) that vercel.json does not
 * know about. `canonicalFor` looks up a built page's own `rel="canonical"`
 * href by pathname; a path with no built page (an external site's route
 * shape, e.g. the Comfy Workflows app) is skipped, matching the existing
 * coverage test's handling of those routes.
 */
export function findCanonicalDrift(
  links: LlmsTxtLink[],
  canonicalFor: (path: string) => string | undefined
): CanonicalDrift[] {
  const drift: CanonicalDrift[] = []
  for (const { path, link } of internalLinks(links)) {
    const canonical = canonicalFor(path)
    if (canonical === undefined) continue
    const canonicalUrl = new URL(canonical)
    const linkUrl = new URL(link.url)
    if (
      canonicalUrl.origin !== linkUrl.origin ||
      normalizePath(canonicalUrl.pathname) !== path
    ) {
      drift.push({ link, canonical })
    }
  }
  return drift
}

export interface LlmsTxtChecks {
  redirectSources: readonly string[]
  isServed: (path: string) => boolean
  canonicalFor: (path: string) => string | undefined
}

/** Every stale link in one llms.txt body, one readable line per problem. */
export function findStaleLinks(
  llmsTxt: string,
  { redirectSources, isServed, canonicalFor }: LlmsTxtChecks
): string[] {
  const links = parseLlmsTxtLinks(llmsTxt)
  const redirected = findRedirectedLinks(links, redirectSources)
  const live = links.filter((link) => !redirected.includes(link))
  const missing = findMissingLinks(live, isServed)
  const built = live.filter((link) => !missing.includes(link))
  const describe = (link: LlmsTxtLink) => `[${link.title}](${link.url})`
  return [
    ...redirected.map((link) => `${describe(link)} is a redirect source`),
    ...missing.map((link) => `${describe(link)} is not in the build`),
    ...findCanonicalDrift(built, canonicalFor).map(
      ({ link, canonical }) =>
        `${describe(link)} now canonicalizes to ${canonical}`
    )
  ]
}
