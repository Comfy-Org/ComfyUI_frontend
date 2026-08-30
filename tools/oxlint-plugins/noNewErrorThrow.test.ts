import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createNoNewErrorThrowRule } from './noNewErrorThrow'

interface Diagnostic {
  readonly code?: string
  readonly filename?: string
  readonly message?: string
  readonly severity?: string
}

const root = path.resolve('.')
const oxlintEntry = path.join(root, 'node_modules/oxlint/bin/oxlint')
const repoConfig = path.join(root, '.oxlintrc.json')
const rulePath = path.join(root, 'tools/oxlint-plugins/noNewErrorThrow.ts')
const ruleFactoryName = createNoNewErrorThrowRule.name
const ruleCode = 'test(no-new-error-throw)'
const repoRuleCode = 'comfy(no-new-error-throw)'

function diagnosticsFrom(output: string): readonly Diagnostic[] {
  const parsed: unknown = JSON.parse(output)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('diagnostics' in parsed) ||
    !Array.isArray(parsed.diagnostics)
  ) {
    throw new TypeError('Invalid Oxlint JSON report')
  }
  return parsed.diagnostics
}

function lint(
  cwd: string,
  config: string,
  targets: readonly string[]
): readonly Diagnostic[] {
  const result = spawnSync(
    process.execPath,
    [oxlintEntry, '--format=json', '--config', config, ...targets],
    { cwd, encoding: 'utf8' }
  )
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `Oxlint exited ${result.status}`)
  }
  return diagnosticsFrom(result.stdout)
}

describe('no-new-error-throw', () => {
  let workDir: string
  let findings: readonly Diagnostic[]

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'comfy-no-new-error-'))
    const allowances = {
      'existing.ts': { "new Error ( 'existing' )": 1 },
      'duplicate.ts': { "new Error ( 'duplicate' )": 1 },
      'changed.ts': { "new Error ( 'before' )": 1 },
      'stale.ts': { "new Error ( 'removed' )": 1 },
      'formatted.ts': { "new Error ( 'formatted' )": 1 }
    }
    const exceptions = [
      {
        file: 'exception.ts',
        expression: "new Error ( 'fail closed' )",
        count: 1,
        reference: 'FE-1859',
        rationale: 'The fixture verifies centralized approved exceptions.'
      }
    ]
    writeFileSync(
      path.join(workDir, 'plugin.ts'),
      `import { ${ruleFactoryName} } from ${JSON.stringify(rulePath)}

export default {
  meta: { name: 'test' },
  rules: {
    'no-new-error-throw': ${ruleFactoryName}(${JSON.stringify(allowances)}, ${JSON.stringify(exceptions)})
  }
}
`
    )
    writeFileSync(
      path.join(workDir, '.oxlintrc.json'),
      JSON.stringify({
        jsPlugins: [path.join(workDir, 'plugin.ts')],
        rules: { 'test/no-new-error-throw': 'error' }
      })
    )
    writeFileSync(
      path.join(workDir, 'existing.ts'),
      "throw new Error('existing')\n"
    )
    writeFileSync(
      path.join(workDir, 'duplicate.ts'),
      "throw new Error('duplicate')\nthrow new Error('duplicate')\n"
    )
    writeFileSync(
      path.join(workDir, 'changed.ts'),
      "throw new Error('after')\n"
    )
    writeFileSync(path.join(workDir, 'stale.ts'), 'export {}\n')
    writeFileSync(
      path.join(workDir, 'formatted.ts'),
      `

throw new Error(
  /* line and formatting changes do not alter the token fingerprint */
  'formatted'
)
`
    )
    writeFileSync(path.join(workDir, 'new.ts'), "throw new Error('new')\n")
    writeFileSync(
      path.join(workDir, 'exception.ts'),
      "throw new Error('fail closed')\n"
    )
    writeFileSync(
      path.join(workDir, 'allowed.ts'),
      `class DomainError extends Error {}

try {
  throw new TypeError('typed')
} catch (error) {
  if (error instanceof DomainError) throw error
  throw new DomainError('domain')
}

{
  class Error {}
  throw new Error('shadowed')
}
`
    )

    findings = lint(workDir, path.join(workDir, '.oxlintrc.json'), [
      '.'
    ]).filter(({ code }) => code === ruleCode)
  })

  afterAll(() => rmSync(workDir, { recursive: true, force: true }))

  function messagesFor(file: string): string[] {
    return findings
      .filter(({ filename }) => filename?.endsWith(file))
      .map(({ message }) => message ?? '')
  }

  it('accepts an existing fingerprint and formatting or line shifts', () => {
    expect(messagesFor('existing.ts')).toEqual([])
    expect(messagesFor('formatted.ts')).toEqual([])
  })

  it('accepts a centralized approved fail-closed exception', () => {
    expect(messagesFor('exception.ts')).toEqual([])
  })

  it('reports a new literal at error severity', () => {
    expect(messagesFor('new.ts')).toEqual([
      expect.stringContaining('Do not add')
    ])
    expect(
      findings.find(({ filename }) => filename?.endsWith('new.ts'))?.severity
    ).toBe('error')
  })

  it('reports duplicate increases', () => {
    expect(messagesFor('duplicate.ts')).toEqual([
      expect.stringContaining('Do not add')
    ])
  })

  it('reports changed arguments and the stale old fingerprint', () => {
    expect(messagesFor('changed.ts')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Do not add'),
        expect.stringContaining('Stale no-new-error allowance')
      ])
    )
  })

  it('reports stale baseline entries', () => {
    expect(messagesFor('stale.ts')).toEqual([
      expect.stringContaining('Stale no-new-error allowance')
    ])
  })

  it('allows rethrows, built-in subclasses, domain classes, and shadowed Error', () => {
    expect(messagesFor('allowed.ts')).toEqual([])
  })
})

describe('repository no-new-error policy', () => {
  const productionProbeDir = path.join(root, 'src/__no_new_error_probes__')
  const browserProbeDir = path.join(
    root,
    'browser_tests/__no_new_error_probes__'
  )
  const toolProbeDir = path.join(
    root,
    'tools/oxlint-plugins/__no_new_error_probes__'
  )
  const legacyProbeFiles = [
    path.join(root, 'src/extensions/core/noNewErrorThrowProbe.ts'),
    path.join(root, 'src/scripts/noNewErrorThrowProbe.ts')
  ]
  let findings: readonly Diagnostic[]

  beforeAll(() => {
    for (const directory of [
      productionProbeDir,
      path.join(productionProbeDir, 'fixtures'),
      browserProbeDir,
      toolProbeDir
    ]) {
      mkdirSync(directory, { recursive: true })
    }
    for (const file of [
      path.join(productionProbeDir, 'production.ts'),
      path.join(productionProbeDir, 'production.vue'),
      path.join(productionProbeDir, 'production.test.ts'),
      path.join(productionProbeDir, 'production.stories.ts'),
      path.join(productionProbeDir, 'fixtures/fixture.ts'),
      path.join(browserProbeDir, 'browser.ts'),
      path.join(toolProbeDir, 'tool.ts'),
      ...legacyProbeFiles
    ]) {
      writeFileSync(file, "throw new Error('scope probe')\n")
    }
    writeFileSync(
      path.join(productionProbeDir, 'production.vue'),
      `<script setup lang="ts">
throw new Error('scope probe')
</script>

<template><div /></template>
`
    )

    findings = lint(root, repoConfig, [
      'src',
      'browser_tests',
      'tools/oxlint-plugins'
    ]).filter(({ code }) => code === repoRuleCode)
  })

  afterAll(() => {
    for (const directory of [
      productionProbeDir,
      browserProbeDir,
      toolProbeDir
    ]) {
      rmSync(directory, { recursive: true, force: true })
    }
    for (const file of legacyProbeFiles) rmSync(file, { force: true })
  })

  it('covers production TypeScript and Vue files only', () => {
    expect(findings).toHaveLength(2)
    expect(
      findings.map(({ filename }) => path.extname(filename ?? '')).sort()
    ).toEqual(['.ts', '.vue'])
  })
})
