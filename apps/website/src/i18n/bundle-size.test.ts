import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'

const i18nDir = dirname(fileURLToPath(import.meta.url))

/**
 * What stops the per-locale split from being undone by accident.
 *
 * Before P3-1, `translations.ts` held every locale inline and shipped to the
 * browser, so an English reader downloaded 80 KB gzipped of Chinese and filling
 * Japanese would have added ~85 KB more for everyone on every page. The split
 * moved that data to `source.ts` and left the client reading one pre-resolved
 * dictionary.
 *
 * A single static import of the source data from the client module would put it
 * all back, and nothing else would notice: the site would still build, still
 * render correctly, and still pass every other test. Only the bundle would
 * quietly double. Hence this file.
 */
describe('the client module carries no dictionary of its own', () => {
  const clientSource = readFileSync(join(i18nDir, 'translations.ts'), 'utf8')

  it('imports the layered source for types only', () => {
    // `import type` is erased at build time; a value import is not, and would
    // pull all 2,116 keys in all locales into every visitor's download.
    const sourceImports = [
      ...clientSource.matchAll(/^import (type )?.*from '\.\/source'$/gm)
    ]

    expect(sourceImports.length).toBeGreaterThan(0)
    for (const [line, isTypeOnly] of sourceImports) {
      expect(isTypeOnly, `value import of the copy source: ${line}`).toBe(
        'type '
      )
    }
  })

  it('never imports a machine layer, which lives behind the source now', () => {
    expect(clientSource).not.toContain('./content/')
  })

  it('loads dictionaries lazily, so each locale is its own chunk', () => {
    // `{ eager: true }` would inline all of them into one chunk and undo the
    // split while leaving every other test green.
    expect(clientSource).toContain('import.meta.glob<TranslationLayer>(')
    // The option, not the word: prose about eagerness matched the bare word.
    expect(clientSource).not.toMatch(/eager\s*:/)
  })
})

describe('per-locale dictionary budget', () => {
  /**
   * Roughly one locale's worth of resolved copy. A dictionary is fully resolved,
   * so it holds a string for every key whether or not that key is translated,
   * and English text is the bulk of it.
   *
   * This is a per-VISITOR cost now rather than a shared one: crossing it costs
   * only that locale's readers, not everybody. Raise it deliberately when the
   * copy genuinely grows, and say why.
   */
  const BUDGET_BYTES = 320_000

  it.for(LOCALE_CODES)('keeps %s within budget', (locale) => {
    const file = join(i18nDir, 'resolved', `${locale}.json`)
    const bytes = statSync(file).size

    expect(
      bytes,
      `src/i18n/resolved/${locale}.json is ${bytes} bytes, downloaded by every ` +
        `${locale} visitor.`
    ).toBeLessThan(BUDGET_BYTES)
  })
})
