import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON = join(SRC_DIR, '..', 'package.json')
const VUE_IMPORT = /from\s+['"](vue|@vueuse\/[^'"]+)['"]/
const VUE_DEPENDENCY = /^(vue|vue-tsc|@vueuse\/|@vitejs\/plugin-vue)/

describe('vue boundary', () => {
  it('keeps the whole package free of Vue, so it is consumable without Vue', () => {
    const offenders = readdirSync(SRC_DIR, { recursive: true })
      .map(String)
      .filter((name) => /\.(ts|vue)$/.test(name) && !name.endsWith('.test.ts'))
      .filter((name) =>
        VUE_IMPORT.test(readFileSync(join(SRC_DIR, name), 'utf8'))
      )

    expect(offenders).toEqual([])
  })

  it('declares no Vue dependency of any kind', () => {
    const manifest: Record<string, Record<string, string> | undefined> =
      JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))

    const declared = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ].flatMap((field) => Object.keys(manifest[field] ?? {}))

    expect(declared.filter((name) => VUE_DEPENDENCY.test(name))).toEqual([])
  })

  it('ships no view entry, so a host reaches the Vue layer through @comfyorg/account-ui', () => {
    const { exports: entries }: { exports: Record<string, string> } =
      JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))

    expect(
      Object.values(entries).filter((file) => file.endsWith('.vue'))
    ).toEqual([])
  })
})
