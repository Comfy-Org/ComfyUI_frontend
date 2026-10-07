import { escapeRegExp } from 'es-toolkit'

interface Redirect {
  readonly source: string
  readonly destination: string
  readonly permanent: boolean
}

interface PublishedModelPagesInput {
  /** The committed list of model pages that have ever been published. */
  readonly published: readonly string[]
  /** Every page this build serves, indexed or not; redirect stubs excluded. */
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

const SOURCE_PARAM = /(:\w+(?:\([^()]*\))?)/
const LITERAL_ALTERNATIVE = /^[\w.~-]+$/
const UNSUPPORTED_SOURCE_SYNTAX = /[(){}?*+]/

function unsupportedSource(source: string): Error {
  return new Error(`Unsupported redirect source syntax: ${source}`)
}

function paramPattern(token: string, source: string): string {
  if (!token.includes('(')) return `(?<${token.slice(1)}>[^/]+)`
  const [name, alternatives] = token.slice(1, -1).split('(')
  const literals = alternatives.split('|')
  if (!literals.every((literal) => LITERAL_ALTERNATIVE.test(literal)))
    throw unsupportedSource(source)
  return `(?<${name}>${literals.map(escapeRegExp).join('|')})`
}

/**
 * A Vercel redirect source as an exact, slash-sensitive matcher: literal text
 * plus `:name` (one segment) and `:name(a|b)` (literal alternatives) params.
 * Any other path-to-regexp syntax throws rather than silently matching nothing.
 */
function redirectSourcePattern(source: string): RegExp {
  const pattern = source
    .split(SOURCE_PARAM)
    .map((part, index) => {
      if (index % 2 === 1) return paramPattern(part, source)
      if (UNSUPPORTED_SOURCE_SYNTAX.test(part)) throw unsupportedSource(source)
      return escapeRegExp(part)
    })
    .join('')
  return new RegExp(`^${pattern}$`)
}

interface CompiledRedirect extends Redirect {
  readonly pattern: RegExp
}

function resolveRedirect(
  page: string,
  redirects: readonly CompiledRedirect[]
): Redirect | undefined {
  for (const redirect of redirects) {
    const match = redirect.pattern.exec(page)
    if (match)
      return {
        ...redirect,
        destination: redirect.destination.replace(
          /:(\w+)/g,
          (param, name: string) => match.groups?.[name] ?? param
        )
      }
  }
  return undefined
}

function removalProblem(
  page: string,
  live: ReadonlySet<string>,
  redirects: readonly CompiledRedirect[]
): string | undefined {
  const redirect = resolveRedirect(page, redirects)
  if (!redirect)
    return `${page} removed: add a permanent redirect in src/config/redirects.ts or restore the page`
  if (!redirect.permanent)
    return `${page} removed: its redirect to ${redirect.destination} is temporary; make it permanent in src/config/redirects.ts`
  if (!live.has(redirect.destination))
    return `${page} removed: its redirect lands on ${redirect.destination}, which this build does not serve`
  return undefined
}

export function auditPublishedModelPages({
  published,
  live,
  redirects,
  retiredWithoutRedirect
}: PublishedModelPagesInput): string[] {
  const listed = new Set(published)
  const retirementProblems = Object.entries(retiredWithoutRedirect).flatMap(
    ([page, reason]) => [
      ...(reason.trim() === '' ? [`${page} is retired without a reason`] : []),
      ...(listed.has(page)
        ? []
        : [`${page} is retired but is not in the published list`]),
      ...(live.has(page)
        ? [`${page} is retired but this build still serves it`]
        : [])
    ]
  )
  const compiled = redirects.map((redirect) => ({
    ...redirect,
    pattern: redirectSourcePattern(redirect.source)
  }))
  const removed = published
    .filter((page) => !live.has(page) && !(page in retiredWithoutRedirect))
    .flatMap((page) => removalProblem(page, live, compiled) ?? [])
  return [...retirementProblems, ...removed]
}

const REDIRECT_STUB = /<meta http-equiv="refresh"/i

/** The route a built `index.html` serves, or nothing for a redirect stub. */
export function servedRoute(
  indexPath: string,
  html: string
): string | undefined {
  if (REDIRECT_STUB.test(html)) return undefined
  const directory = indexPath.replace(/(^|\/)index\.html$/, '')
  return directory === '' ? '/' : `/${directory}/`
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

/** Pages the base branch's list had that this list dropped without retiring them. */
export function droppedModelPages(
  basePublished: readonly string[],
  published: readonly string[],
  retiredWithoutRedirect: Readonly<Record<string, string>>
): string[] {
  const kept = new Set(published)
  return basePublished
    .filter((page) => !kept.has(page) && !(page in retiredWithoutRedirect))
    .sort()
}
