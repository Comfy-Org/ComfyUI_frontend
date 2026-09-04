import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'
import type { Locale } from '../config/locales'
import { resolveTranslation, translationKeys } from './source'

const i18nDir = dirname(fileURLToPath(import.meta.url))
const srcDir = dirname(i18nDir)
const websiteDir = dirname(srcDir)

function readResolved(locale: Locale): Record<string, string> {
  return JSON.parse(
    readFileSync(join(i18nDir, 'resolved', `${locale}.json`), 'utf8')
  ) as Record<string, string>
}

function walk(dir: string, suffix: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, suffix, acc)
    else if (entry.endsWith(suffix)) acc.push(full)
  }
  return acc
}

/**
 * The dictionaries the browser loads are derived from `source.ts`. If what is
 * committed drifts from what the resolver would produce, the server renders one
 * string and the browser another, and Vue quietly patches the difference. That
 * is far harder to notice than a red test, so this re-derives every value.
 */
describe('resolved dictionaries match the source they came from', () => {
  it.for(LOCALE_CODES)('%s reproduces the resolver exactly', (locale) => {
    const resolved = readResolved(locale)
    const wrong = translationKeys.filter(
      (key) => resolved[key] !== resolveTranslation(key, locale).value
    )

    expect(
      wrong.slice(0, 5),
      `src/i18n/resolved/${locale}.json is stale for ${wrong.length} key(s). ` +
        `Run \`pnpm i18n:build-resolved\`.`
    ).toEqual([])
  })

  it.for(LOCALE_CODES)('%s carries every key in source order', (locale) => {
    // Order is load-bearing: LegalContentSection.vue walks translationKeys to
    // order its sections, and in the browser that list is these keys.
    expect(Object.keys(readResolved(locale))).toEqual(translationKeys)
  })
})

describe('the per-locale split cannot be silently undone', () => {
  it('never asks the browser for a locale its page did not load', () => {
    // In the browser only the page's own locale is loaded, so `t(key)` with no
    // locale — which defaults to English — throws on a Japanese page. All the
    // calls that name a locale literally are in `.astro` files, which run on
    // the server where every locale is present.
    const offenders = walk(srcDir, '.vue')
      .filter((file) => /\bt\('[^']+'\)/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(websiteDir.length + 1))

    expect(
      offenders,
      'These components call t() without a locale, so they would render ' +
        'English on a localized page and throw once hydrated. Pass the ' +
        "component's `locale` through."
    ).toEqual([])
  })

  it('keeps the pipeline off the client module, which tsx cannot load', () => {
    // translations.ts uses import.meta.glob. Under tsx that is not a function
    // and import.meta.env is undefined, so any script reaching it dies.
    const clientModule = join(i18nDir, 'translations')

    // Resolved, not pattern-matched: the pipeline's own adapter is ALSO called
    // translations.ts, and matching on the name alone flags it every time.
    const offenders = [
      ...walk(join(websiteDir, 'scripts', 'i18n'), '.ts'),
      ...walk(join(i18nDir, 'pipeline'), '.ts')
    ]
      .filter((file) => !file.endsWith('.test.ts'))
      .filter((file) =>
        [...readFileSync(file, 'utf8').matchAll(/from '(\.[^']*)'/g)].some(
          ([, specifier]) => join(dirname(file), specifier) === clientModule
        )
      )
      .map((file) => file.slice(websiteDir.length + 1))

    expect(offenders).toEqual([])
  })
})
