interface Redirect {
  readonly source: string
  readonly destination: string
  readonly permanent: boolean
}

interface PublishedModelPagesInput {
  /** The committed list of model pages that have ever been published. */
  readonly published: readonly string[]
  /** Every page in this build's sitemap: published, indexable, served 200. */
  readonly live: ReadonlySet<string>
  readonly redirects: readonly Redirect[]
  /** Published page → why it may stay a 404. */
  readonly retiredWithoutRedirect: Readonly<Record<string, string>>
}

export function isModelPagePath(
  pathname: string,
  roots: readonly string[],
  localePrefixes: readonly string[]
): boolean {
  const prefix = localePrefixes.find(
    (locale) => locale !== '' && pathname.startsWith(`${locale}/`)
  )
  const path = (prefix ? pathname.slice(prefix.length) : pathname).replace(
    /\/$/,
    ''
  )
  return roots.some((root) => path === root || path.startsWith(`${root}/`))
}

function removalProblem(
  page: string,
  live: ReadonlySet<string>,
  redirects: readonly Redirect[]
): string | undefined {
  const redirect = redirects.find(({ source }) => source === page)
  if (!redirect)
    return `${page} removed: add a permanent redirect in src/config/redirects.ts or restore the page`
  if (!redirect.permanent)
    return `${page} removed: its redirect to ${redirect.destination} is temporary; make it permanent in src/config/redirects.ts`
  if (!live.has(redirect.destination))
    return `${page} removed: its redirect lands on ${redirect.destination}, which is not a published page`
  return undefined
}

export function auditPublishedModelPages({
  published,
  live,
  redirects,
  retiredWithoutRedirect
}: PublishedModelPagesInput): string[] {
  const unexplained = Object.entries(retiredWithoutRedirect)
    .filter(([, reason]) => reason.trim() === '')
    .map(([page]) => `${page} is retired without a reason`)
  const removed = published
    .filter((page) => !live.has(page) && !(page in retiredWithoutRedirect))
    .flatMap((page) => removalProblem(page, live, redirects) ?? [])
  return [...unexplained, ...removed]
}

/** Live model pages missing from the published list. */
export function unrecordedModelPages(
  published: readonly string[],
  liveModelPages: readonly string[]
): string[] {
  const recorded = new Set(published)
  return liveModelPages.filter((page) => !recorded.has(page)).sort()
}

/** The published list with new pages added; it never drops a page. */
export function recordModelPages(
  published: readonly string[],
  liveModelPages: readonly string[]
): string[] {
  return [...new Set([...published, ...liveModelPages])].sort()
}
