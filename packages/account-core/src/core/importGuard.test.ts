import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CORE_DIR = dirname(fileURLToPath(import.meta.url))

const FORBIDDEN_IMPORTS = ['firebase', 'vue', 'pinia', 'astro', '@/']
/** A browser global being read, not the word appearing in a comment. */
const FORBIDDEN_GLOBALS =
  /\b(?:globalThis\.)?(window|document|localStorage|sessionStorage)\s*[.[(]/

/** Any route into Firebase: the SDK, its scoped packages, or this package's firebase entry. */
const FIREBASE_SPECIFIER = /^@?firebase(?:\/|$)|(?:^|\/)firebase(?:\/|\.|$)/

const SPECIFIER = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g

function importSpecifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map(([, specifier]) => specifier)
}

/** Every source file reachable from `entry` through relative imports. */
function relativeImportClosure(entry: string): Map<string, string[]> {
  const closure = new Map<string, string[]>()
  const pending = [resolve(CORE_DIR, entry)]
  for (let file = pending.pop(); file; file = pending.pop()) {
    if (closure.has(file)) continue
    const specifiers = importSpecifiers(readFileSync(file, 'utf8'))
    closure.set(file, specifiers)
    pending.push(
      ...specifiers
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) =>
          resolve(dirname(file), specifier.replace(/\.js$/, '.ts'))
        )
    )
  }
  return closure
}

function specifierPattern(forbidden: string): RegExp {
  const escaped = forbidden.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return new RegExp(
    `(?:from\\s*|import\\s*\\(?\\s*|require\\s*\\(\\s*)['"]${escaped}`
  )
}

describe('core import guard', () => {
  const sources = readdirSync(CORE_DIR, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({
      name,
      text: readFileSync(join(CORE_DIR, name), 'utf8')
    }))

  it('keeps the core free of framework and identity imports', () => {
    for (const { name, text } of sources) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(text, `${name} imports ${forbidden}`).not.toMatch(
          specifierPattern(forbidden)
        )
      }
    }
  })

  it('scans the web session sources', () => {
    expect(sources.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'webSession.ts',
        'sessionTokenMint.ts',
        'webSessionIdentity.ts'
      ])
    )
  })

  it.for(['webSession.ts', 'sessionTokenMint.ts', 'webSessionIdentity.ts'])(
    'keeps %s and everything it imports off Firebase',
    (entry) => {
      const closure = relativeImportClosure(entry)
      const firebaseImports = [...closure].flatMap(([file, specifiers]) =>
        specifiers
          .filter((specifier) => FIREBASE_SPECIFIER.test(specifier))
          .map((specifier) => `${relative(CORE_DIR, file)} -> ${specifier}`)
      )

      expect(
        [...closure.keys()].map((file) => relative(CORE_DIR, file))
      ).toEqual(expect.arrayContaining([entry]))
      expect(firebaseImports).toEqual([])
    }
  )

  it.for([
    'firebase/auth',
    '@firebase/app',
    '../firebase/index.js',
    '@comfyorg/account-core/firebase'
  ])('recognizes %s as a Firebase import', (specifier) => {
    expect(importSpecifiers(`import x from '${specifier}'`)).toEqual([
      specifier
    ])
    expect(specifier).toMatch(FIREBASE_SPECIFIER)
  })

  it('keeps the core off browser globals', () => {
    for (const { name, text } of sources) {
      expect(text, `${name} touches a browser global`).not.toMatch(
        FORBIDDEN_GLOBALS
      )
    }
  })
})
