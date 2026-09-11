import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { DEFAULT_LOCALE, LOCALE_CODES, localePrefix } from './locales'
import { fallbackCollisions, redirects as astroRedirects } from './redirects'
import { getRoutes } from './routes'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const VercelRedirectSchema = z.object({
  source: z.string(),
  destination: z.string(),
  permanent: z.boolean().optional(),
  statusCode: z.number().optional()
})

const VercelConfigSchema = z.object({
  redirects: z.array(VercelRedirectSchema)
})

type VercelRedirect = z.infer<typeof VercelRedirectSchema>

const { redirects } = VercelConfigSchema.parse(
  JSON.parse(readFileSync(join(appDir, 'vercel.json'), 'utf8'))
)

function findRedirect(source: string): VercelRedirect | undefined {
  return redirects.find((redirect) => redirect.source === source)
}

const minimaxCanonical = `${getRoutes('en').minimax}/`
const minimaxZhCanonical = `${getRoutes('zh-CN').minimax}/`

describe('legacy MiniMax H3 redirects', () => {
  it.for([
    { source: '/minimax', destination: minimaxCanonical },
    { source: '/minimax/', destination: minimaxCanonical },
    { source: '/zh-CN/minimax', destination: minimaxZhCanonical },
    { source: '/zh-CN/minimax/', destination: minimaxZhCanonical }
  ])(
    'sends $source to $destination with a temporary status',
    ({ source, destination }) => {
      const redirect = findRedirect(source)

      if (!redirect) {
        throw new Error(`${source} is missing from vercel.json`)
      }

      expect(redirect.destination).toBe(destination)
      expect(redirect.permanent, `${source} must be a temporary redirect`).toBe(
        false
      )
    }
  )

  it.for([
    getRoutes('en').minimax,
    minimaxCanonical,
    getRoutes('zh-CN').minimax,
    minimaxZhCanonical
  ])('leaves the new canonical path %s unredirected', (canonicalPath) => {
    expect(findRedirect(canonicalPath)).toBeUndefined()
  })
})

/**
 * Astro renders a stub page for each entry in its redirect map, and that stub's
 * canonical is the destination string verbatim. Every real page self-canonicalizes
 * with a trailing slash via `absoluteUrl()`, so a slash-less destination points
 * the stub's canonical one hop short of the page it redirects to.
 *
 * #14390 fixed exactly this once already and it regressed, which is why it is a
 * test now rather than a convention.
 */
describe('astro redirect destinations', () => {
  const destinations = Object.values(astroRedirects).map((entry) =>
    typeof entry === 'string' ? entry : entry.destination
  )

  it('every destination ends with a trailing slash', () => {
    const slashless = destinations.filter(
      // A dynamic destination names a route rather than a URL, and Astro
      // rejects it outright when it carries a trailing slash.
      (destination) => !destination.includes('[') && !destination.endsWith('/')
    )
    expect(
      slashless,
      'these canonicalize one hop short of their target'
    ).toEqual([])
  })
})

describe('legacy Enterprise redirects', () => {
  it.for([
    '/cloud/enterprise',
    '/cloud/enterprise/',
    '/zh-CN/cloud/enterprise',
    '/zh-CN/cloud/enterprise/'
  ])('sends %s to the canonical Enterprise route permanently', (source) => {
    const redirect = findRedirect(source)

    if (!redirect) {
      throw new Error(`${source} is missing from vercel.json`)
    }

    expect(redirect.destination).toBe('/enterprise/')
    expect(redirect.permanent).toBe(true)
  })

  it('leaves the canonical Enterprise routes unredirected', () => {
    expect(findRedirect('/enterprise')).toBeUndefined()
    expect(findRedirect('/enterprise/')).toBeUndefined()
    expect(findRedirect('/enterprise/managed-builds')).toBeUndefined()
    expect(findRedirect('/enterprise/managed-builds/')).toBeUndefined()
  })
})

const pagesDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'pages')

/** Every locale prefix except English's, which has none. */
const prefixes = LOCALE_CODES.filter((l) => l !== DEFAULT_LOCALE).map(
  localePrefix
)

/** Every route the English page files serve, as a path with no trailing slash. */
function englishRoutes(dir: string, acc = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      englishRoutes(full, acc)
      continue
    }
    if (!entry.endsWith('.astro')) continue

    const rel = relative(pagesDir, full).replace(/\\/g, '/')
    if (
      LOCALE_CODES.some((l) => l !== DEFAULT_LOCALE && rel.startsWith(`${l}/`))
    )
      continue
    // Dynamic segments cannot be compared as literal paths.
    if (rel.includes('[')) continue

    const route = `/${rel.replace(/\.astro$/, '').replace(/\/index$/, '')}`
    acc.add(route === '/index' ? '/' : route)
  }
  return acc
}

/**
 * A redirect and the i18n fallback cannot both own a path.
 *
 * Astro gives the fallback route higher priority, drops the redirect, and says
 * so only in a build WARNING while still exiting 0. Three redirects were lost
 * that way when Chinese gained a fallback — `/zh-CN/affiliates`,
 * `/zh-CN/affiliates/terms` and `/zh-CN/terms-of-service` — and the URLs went
 * from a 301 to a silent 404.
 *
 * A localized redirect is safe only where the English route does not exist, so
 * no fallback page is generated to collide with it.
 */
describe('redirects cannot collide with the i18n fallback', () => {
  const english = englishRoutes(pagesDir)

  it('reads the English routes it compares against', () => {
    expect(english.size).toBeGreaterThan(40)
    expect(english.has('/pricing')).toBe(true)
  })

  it('declares no localized redirect whose English route exists', () => {
    expect(
      fallbackCollisions(Object.keys(astroRedirects), english, prefixes)
    ).toEqual([])
  })
})

describe('fallbackCollisions', () => {
  const english = new Set(['/', '/pricing', '/cloud/enterprise'])

  it('reports a localized redirect that shadows an English route', () => {
    expect(fallbackCollisions(['/zh-CN/pricing'], english, prefixes)).toEqual([
      '/zh-CN/pricing collides with /pricing'
    ])
  })

  it('says nothing about a route English does not serve', () => {
    expect(fallbackCollisions(['/zh-CN/minimax'], english, prefixes)).toEqual(
      []
    )
  })

  /**
   * English routes are collected without a trailing slash, so `/pricing/` never
   * matched `/pricing` and the guard waved through the one shape of collision
   * it was written to catch — the shape that turned three redirects into silent
   * 404s.
   */
  it('matches a source written with a trailing slash', () => {
    expect(fallbackCollisions(['/zh-CN/pricing/'], english, prefixes)).toEqual([
      '/zh-CN/pricing/ collides with /pricing'
    ])
  })

  /** The bare prefix is the locale home, which collides with `/`. */
  it('matches the locale home', () => {
    expect(fallbackCollisions(['/zh-CN'], english, prefixes)).toEqual([
      '/zh-CN collides with /'
    ])
  })

  it('ignores an unprefixed English redirect', () => {
    expect(fallbackCollisions(['/pricing'], english, prefixes)).toEqual([])
  })
})

/**
 * Asserted as an invariant rather than as a table of every source and
 * destination. A table restating the config would fail on any deliberate edit
 * while catching none of the mistakes that cost anything, which is what
 * `AGENTS.md` means by a change-detector test.
 *
 * The trailing-slash shape is covered by `astro redirect destinations` above.
 */
describe('the redirect table holds together', () => {
  /**
   * A destination that is also a source costs the reader two round trips, and
   * search engines discount a chained redirect. Easy to introduce by retargeting
   * one entry without noticing another already points at it.
   */
  it('sends nobody through two redirects', () => {
    const destinationOf = (
      entry: (typeof astroRedirects)[keyof typeof astroRedirects]
    ) => (typeof entry === 'string' ? entry : entry.destination)
    const sources = new Set(
      Object.keys(astroRedirects).map((s) => s.replace(/\/$/, ''))
    )
    const chained = Object.entries(astroRedirects)
      .map(([from, entry]) => [from, destinationOf(entry)] as const)
      .filter(([, to]) => sources.has(to.replace(/\/$/, '')))
      .map(([from, to]) => `${from} -> ${to}, which is itself a redirect`)

    expect(chained).toEqual([])
  })
})
