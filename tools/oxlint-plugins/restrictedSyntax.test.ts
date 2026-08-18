// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const repoConfig = path.resolve('.oxlintrc.json')
const restrictedConfig = path.resolve(
  'tools/oxlint-plugins/restrictedSyntax.config.json'
)
const sourceProbeDir = path.resolve('src/__restricted_syntax_probes__')
const appProbeDir = path.resolve(
  'apps/desktop-ui/src/__restricted_syntax_probes__'
)

interface OxlintDiagnostic {
  readonly code?: string
  readonly filename?: string
}

function lint(config: string, targets: readonly string[]): OxlintDiagnostic[] {
  let output: string
  try {
    output = execFileSync(
      process.execPath,
      [oxlintEntry, '--format=json', '--config', config, ...targets],
      { cwd: path.resolve('.'), encoding: 'utf8' }
    )
  } catch (error) {
    output = (error as { stdout?: string }).stdout ?? ''
  }
  return (JSON.parse(output) as { diagnostics: OxlintDiagnostic[] }).diagnostics
}

describe('comfy/no-unsafe-error-assertion', () => {
  let findings: readonly OxlintDiagnostic[]

  beforeAll(() => {
    mkdirSync(sourceProbeDir, { recursive: true })
    mkdirSync(appProbeDir, { recursive: true })
    writeFileSync(
      path.join(sourceProbeDir, 'reported.ts'),
      'const asserted = value as Error & { code: string }\nvoid asserted\n'
    )
    writeFileSync(
      path.join(sourceProbeDir, 'ignored.test.ts'),
      'const asserted = value as Error\nvoid asserted\n'
    )
    writeFileSync(
      path.join(appProbeDir, 'reported.ts'),
      'const asserted = <Error>value\nvoid asserted\n'
    )

    findings = [
      ...lint(repoConfig, [sourceProbeDir]),
      ...lint(restrictedConfig, [appProbeDir])
    ].filter(({ code }) => code === 'comfy(no-unsafe-error-assertion)')
  })

  afterAll(() => {
    rmSync(sourceProbeDir, { recursive: true, force: true })
    rmSync(appProbeDir, { recursive: true, force: true })
  })

  it('reports both TypeScript assertion forms in source and app files', () => {
    expect(findings).toHaveLength(2)
    expect(
      findings.some(({ filename }) => filename?.endsWith('reported.ts'))
    ).toBe(true)
    expect(findings.some(({ filename }) => filename?.includes('apps/'))).toBe(
      true
    )
  })

  it('excludes test files', () => {
    expect(
      findings.some(({ filename }) => filename?.endsWith('.test.ts'))
    ).toBe(false)
  })
})
