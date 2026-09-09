import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALE_CODES, localePrefix } from './locales'
import { fallbackCollisions, redirects } from './redirects'

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
      fallbackCollisions(Object.keys(redirects), english, prefixes)
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
 * Asserted as invariants rather than as a table of every source and
 * destination. A table restating the config would fail on any deliberate edit
 * while catching none of the mistakes that actually cost anything, which is
 * what `AGENTS.md` means by a change-detector test. These two are the shapes a
 * redirect gets wrong in ways nobody notices.
 */
describe('the redirect table holds together', () => {
  const destinationOf = (entry: (typeof redirects)[keyof typeof redirects]) =>
    typeof entry === 'string' ? entry : entry.destination

  /**
   * A destination that is also a source costs the reader two round trips, and
   * search engines discount a chained redirect. Easy to introduce by retargeting
   * one entry without noticing another already points at it.
   */
  it('sends nobody through two redirects', () => {
    const sources = new Set(
      Object.keys(redirects).map((s) => s.replace(/\/$/, ''))
    )
    const chained = Object.entries(redirects)
      .map(([from, entry]) => [from, destinationOf(entry)] as const)
      .filter(([, to]) => sources.has(to.replace(/\/$/, '')))
      .map(([from, to]) => `${from} -> ${to}, which is itself a redirect`)

    expect(chained).toEqual([])
  })

  /**
   * The site serves directory URLs, so a destination without the trailing slash
   * lands on Astro's own normalising redirect and the reader pays a second hop
   * for a link that looked right in review.
   */
  it('points every destination at a directory URL', () => {
    const bare = Object.values(redirects)
      .map(destinationOf)
      .filter((to) => !to.endsWith('/'))

    expect(bare).toEqual([])
  })
})
