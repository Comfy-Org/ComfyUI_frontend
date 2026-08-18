// @vitest-environment node

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runOxlint } from './oxlintTestUtil'
import type { OxlintDiagnostic } from './oxlintTestUtil'

const probeDir = path.resolve('src/__computed_dom_probes__')

const source = `import { computed } from 'vue'

const measured = computed(() => element.getBoundingClientRect())
const styled = computed(() => window.getComputedStyle(element))
const selected = computed(() => element.querySelector('.item'))
const selectedAll = computed(() => element.querySelectorAll('.item'))
const nested = computed(() => () => element.getBoundingClientRect())

const rect = element.getBoundingClientRect()
const dynamic = computed(() => element['querySelector']('.item'))
const unrelated = other(() => element.querySelector('.item'))

void measured
void styled
void selected
void selectedAll
void nested
void rect
void dynamic
void unrelated
`

const testSource = `import { computed } from 'vue'

computed(() => element.getBoundingClientRect())
`

describe('comfy/no-dom-in-computed', () => {
  let findings: readonly OxlintDiagnostic[]

  beforeAll(() => {
    mkdirSync(probeDir, { recursive: true })
    writeFileSync(path.join(probeDir, 'reported.ts'), source)
    writeFileSync(path.join(probeDir, 'ignored.test.ts'), testSource)

    findings = runOxlint([
      '--format=json',
      '--config',
      path.resolve('.oxlintrc.json'),
      probeDir
    ]).filter((diagnostic) => diagnostic.code === 'comfy(no-dom-in-computed)')
  })

  afterAll(() => {
    rmSync(probeDir, { recursive: true, force: true })
  })

  it('reports DOM measurement and inspection in computed calls', () => {
    expect(findings).toHaveLength(5)
    expect(findings.map(({ message }) => message)).toEqual([
      expect.stringContaining('Do not measure the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not measure the DOM')
    ])
  })

  it('preserves warning severity and excludes test files', () => {
    expect(findings.every(({ severity }) => severity === 'warning')).toBe(true)
    expect(
      findings.every(({ filename }) => filename.endsWith('reported.ts'))
    ).toBe(true)
  })
})
