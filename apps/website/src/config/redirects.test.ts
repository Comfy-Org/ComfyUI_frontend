import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALE_CODES, localePrefix } from './locales'
import { redirects } from './redirects'

const pagesDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'pages')

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
    const offenders = Object.keys(redirects)
      .map((from) => {
        const locale = LOCALE_CODES.find(
          (l) => l !== DEFAULT_LOCALE && from.startsWith(`${localePrefix(l)}/`)
        )
        if (!locale) return null
        const route = from.slice(localePrefix(locale).length)
        return english.has(route) ? `${from} collides with ${route}` : null
      })
      .filter(Boolean)

    expect(offenders).toEqual([])
  })
})
