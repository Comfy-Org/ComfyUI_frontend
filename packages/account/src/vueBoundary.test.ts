import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = dirname(fileURLToPath(import.meta.url))
const VUE_IMPORT = /from\s+['"](vue|@vueuse\/[^'"]+)['"]/

describe('vue boundary', () => {
  it('keeps every Vue and VueUse import under src/vue, so the rest is consumable without Vue', () => {
    const offenders = readdirSync(SRC_DIR, { recursive: true })
      .map(String)
      .filter(
        (name) =>
          /\.(ts|vue)$/.test(name) &&
          !name.endsWith('.test.ts') &&
          !name.startsWith('vue/')
      )
      .filter((name) =>
        VUE_IMPORT.test(readFileSync(join(SRC_DIR, name), 'utf8'))
      )

    expect(offenders).toEqual([])
  })
})
