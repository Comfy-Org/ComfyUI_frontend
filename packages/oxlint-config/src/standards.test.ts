import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

import imports from './imports.js'

const cli = join(
  dirname(fileURLToPath(import.meta.resolve('oxlint/package.json'))),
  'bin/oxlint'
)

function lint(
  source: string,
  filename = 'probe.ts',
  rules: Record<string, 'error'> = {}
) {
  const directory = mkdtempSync(join(tmpdir(), 'comfyorg-oxlint-'))
  try {
    const config = join(directory, '.oxlintrc.json')
    const preset = join(directory, 'imports.json')
    const file = join(directory, filename)
    writeFileSync(preset, JSON.stringify(imports))
    writeFileSync(config, JSON.stringify({ extends: [preset], rules }))
    writeFileSync(file, source)
    const result = spawnSync(
      process.execPath,
      [cli, '--config', config, '--format=json', file],
      { encoding: 'utf8' }
    )
    if (result.error) throw result.error
    return result
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test.for([
  {
    name: 'unmarked type imports',
    source: 'import { Ref } from "vue"; export type Value = Ref<string>',
    corrected:
      'import type { Ref } from "vue"; export type Value = Ref<string>',
    rule: 'typescript(consistent-type-imports)'
  },
  {
    name: 'inline type imports',
    source: 'import { type Ref } from "vue"; export type Value = Ref<string>',
    corrected:
      'import type { Ref } from "vue"; export type Value = Ref<string>',
    rule: 'import(consistent-type-specifier-style)'
  },
  {
    name: 'mixed imports',
    source:
      'import { ref, type Ref } from "vue"; export const value: Ref<string> = ref("")',
    corrected:
      'import { ref } from "vue"; import type { Ref } from "vue"; export const value: Ref<string> = ref("")',
    rule: 'import(consistent-type-specifier-style)'
  }
])(
  'rejects $name and accepts separate type imports',
  ({ source, corrected, rule }) => {
    const invalid = lint(source)
    const valid = lint(corrected)
    expect(invalid.status).toBe(1)
    expect(invalid.stdout).toContain(rule)
    expect(valid.status).toBe(0)
  }
)

test('enforces separate type imports in Vue scripts', () => {
  const invalid = lint(
    '<script setup lang="ts">import { ref, type Ref } from "vue"; const value: Ref<string> = ref("")</script><template>{{ value }}</template>',
    'Probe.vue'
  )
  const valid = lint(
    '<script setup lang="ts">import { ref } from "vue"; import type { Ref } from "vue"; const value: Ref<string> = ref("")</script><template>{{ value }}</template>',
    'Probe.vue'
  )
  expect(invalid.status).toBe(1)
  expect(invalid.stdout).toContain('import(consistent-type-specifier-style)')
  expect(valid.status).toBe(0)
})

test('preserves imports used as values by Vue templates', () => {
  const result = lint(
    '<script setup lang="ts">import Component from "./Component.vue"; defineProps<{ component: Component }>()</script><template><Component /></template>',
    'Probe.vue'
  )
  expect(result.status).toBe(0)
})

test('keeps repository rules when extending the import preset', () => {
  const result = lint(
    'import { type Ref } from "vue"; export type Value = Ref<string>; console.log("probe")',
    'probe.ts',
    { 'no-console': 'error' }
  )
  expect(result.status).toBe(1)
  expect(result.stdout).toContain('import(consistent-type-specifier-style)')
  expect(result.stdout).toContain('eslint(no-console)')
})
