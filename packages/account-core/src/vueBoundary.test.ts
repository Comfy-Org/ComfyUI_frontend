import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON = join(SRC_DIR, '..', 'package.json')
const COMMENT_OR_STRING =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const VUE_IMPORT =
  /(?:from|import|require)\s*(?:\?\.)?\s*\(?\s*['"](?:vue|@vueuse\/[^'"]+)['"]/
const VUE_DEPENDENCY = /^(vue|vue-tsc|@vueuse\/|@vitejs\/plugin-vue)/

const withoutComments = (source: string) =>
  source.replace(COMMENT_OR_STRING, (token) =>
    token.startsWith('/') ? ' ' : token
  )

const importsVue = (source: string) => VUE_IMPORT.test(withoutComments(source))

describe('vue boundary', () => {
  it.for([
    ["import { ref } from 'vue'", true],
    ["import type { Ref } from 'vue'", true],
    ["import 'vue'", true],
    ["const { ref } = await import('vue')", true],
    ["require('vue')", true],
    ["require?.('vue')", true],
    ["require?.('@vueuse/core')", true],
    ["import { useNow } from '@vueuse/core'", true],
    ["await import('@vueuse/core')", true],
    ["import /* bypass */ 'vue'", true],
    ["await import(/* bypass */ 'vue')", true],
    ["require(/* bypass */ 'vue')", true],
    ["import { ref } from /* keep */ 'vue'", true],
    ["const open = '/*'\nimport 'vue'\nconst close = '*/'", true],
    ["const glob = '/*.ts'\nimport { ref } from 'vue'\n/** doc */", true],
    ["const url = 'https://comfy.org'; import 'vue'", true],
    ['const snippet = "import { ref } from \'vue\'"', true],
    ["import { createSession } from './vue'", false],
    ["import { useRoute } from 'vue-router'", false],
    ["import { cn } from '@vueuse-lookalike/core'", false],
    ["// import { ref } from 'vue'", false],
    ["/* import { ref } from 'vue' */", false],
    ["// see https://comfy.org, then import 'vue'", false]
  ] as const)('reads %s as a Vue import: %s', ([source, isVueImport]) => {
    expect(importsVue(source)).toBe(isVueImport)
  })

  it('imports Vue from no source file of its own', () => {
    const offenders = readdirSync(SRC_DIR, { recursive: true })
      .map(String)
      .filter((name) => /\.(ts|vue)$/.test(name) && !name.endsWith('.test.ts'))
      .filter((name) => importsVue(readFileSync(join(SRC_DIR, name), 'utf8')))

    expect(offenders).toEqual([])
  })

  it('declares no Vue dependency of any kind, direct only', () => {
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
