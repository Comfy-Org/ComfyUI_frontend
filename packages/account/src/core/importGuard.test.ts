import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CORE_DIR = dirname(fileURLToPath(import.meta.url))

const FORBIDDEN_IMPORTS = ['firebase', 'vue', 'pinia', 'astro', '@/']
const FORBIDDEN_GLOBALS = /\b(window|document|localStorage|sessionStorage)\b/

describe('core import guard', () => {
  const sources = readdirSync(CORE_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({
      name,
      text: readFileSync(join(CORE_DIR, name), 'utf8')
    }))

  it('keeps the core free of framework and identity imports', () => {
    for (const { name, text } of sources) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(text, `${name} imports ${forbidden}`).not.toMatch(
          new RegExp(`from '${forbidden}`)
        )
        expect(text, `${name} dynamically imports ${forbidden}`).not.toMatch(
          new RegExp(`import\\('${forbidden}`)
        )
      }
    }
  })

  it('keeps the core off browser globals', () => {
    for (const { name, text } of sources) {
      expect(text, `${name} touches a browser global`).not.toMatch(
        FORBIDDEN_GLOBALS
      )
    }
  })
})
