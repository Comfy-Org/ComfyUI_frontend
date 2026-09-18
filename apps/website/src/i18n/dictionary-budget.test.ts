import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'

const i18nDir = dirname(fileURLToPath(import.meta.url))

describe('raw per-locale dictionary content budget', () => {
  const BUDGET_BYTES = 390_000

  it.for(LOCALE_CODES)('keeps %s within budget', (locale) => {
    const file = join(i18nDir, 'resolved', `${locale}.json`)
    const bytes = statSync(file).size

    expect(bytes).toBeLessThan(BUDGET_BYTES)
  })
})
