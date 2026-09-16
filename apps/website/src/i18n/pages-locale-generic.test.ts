import { readdirSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isLocale } from '../config/locales'

describe('locale-independent page files', () => {
  it('keeps page sources outside locale-specific directories', () => {
    const pages = readdirSync(
      join(dirname(fileURLToPath(import.meta.url)), '../pages'),
      { recursive: true, encoding: 'utf8' }
    ).filter((file) => file.endsWith('.astro'))

    expect(pages.length).toBeGreaterThan(0)
    expect(pages.filter((file) => file.split(sep).some(isLocale))).toEqual([])
  })
})
