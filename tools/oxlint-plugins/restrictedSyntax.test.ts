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
const remoteProbeDir = path.resolve(
  'src/platform/remote/__restricted_syntax_probes__'
)
const misplacedSpecProbe = path.resolve(
  'src/__restricted_syntax_probes__/misplaced.spec.ts'
)
const fixtureDataProbeDir = path.resolve(
  'browser_tests/fixtures/data/__restricted_syntax_probes__'
)
const browserUnitTestProbe = path.resolve(
  'browser_tests/tests/__restricted_syntax_probes__/misplaced.test.ts'
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

describe('comfy/no-new-zod-for-remote-api-types', () => {
  let findings: readonly OxlintDiagnostic[]

  beforeAll(() => {
    mkdirSync(remoteProbeDir, { recursive: true })
    writeFileSync(
      path.join(remoteProbeDir, 'reported.ts'),
      "import { z } from 'zod'\nexport const schema = z.string()\n"
    )
    writeFileSync(
      path.join(remoteProbeDir, 'ignored.test.ts'),
      "import { z } from 'zod'\nexport const schema = z.string()\n"
    )
    findings = lint(repoConfig, [remoteProbeDir]).filter(
      ({ code }) => code === 'comfy(no-new-zod-for-remote-api-types)'
    )
  })

  afterAll(() => {
    rmSync(remoteProbeDir, { recursive: true, force: true })
  })

  it('reports Zod imports in remote source but not tests', () => {
    expect(findings).toHaveLength(1)
    expect(findings[0]?.filename).toMatch(/reported\.ts$/)
  })
})

describe('comfy/no-misplaced-spec-files', () => {
  beforeAll(() => {
    mkdirSync(path.dirname(misplacedSpecProbe), { recursive: true })
    writeFileSync(misplacedSpecProbe, "test('misplaced', () => {})\n")
  })

  afterAll(() => {
    rmSync(path.dirname(misplacedSpecProbe), { recursive: true, force: true })
  })

  it('reports spec files outside the browser and app e2e directories', () => {
    const findings = lint(restrictedConfig, [misplacedSpecProbe]).filter(
      ({ code }) => code === 'comfy(no-misplaced-spec-files)'
    )
    expect(findings).toHaveLength(1)
  })
})

describe('comfy/no-playwright-imports-in-fixture-data', () => {
  beforeAll(() => {
    mkdirSync(fixtureDataProbeDir, { recursive: true })
    writeFileSync(
      path.join(fixtureDataProbeDir, 'reported.ts'),
      "import { expect } from '@playwright/test'\nvoid expect\n"
    )
  })

  afterAll(() => {
    rmSync(fixtureDataProbeDir, { recursive: true, force: true })
  })

  it('reports Playwright imports in static fixture data', () => {
    const findings = lint(repoConfig, [fixtureDataProbeDir]).filter(
      ({ code }) => code === 'comfy(no-playwright-imports-in-fixture-data)'
    )
    expect(findings).toHaveLength(1)
  })
})

describe('comfy/no-unit-test-files-in-browser-tests', () => {
  beforeAll(() => {
    mkdirSync(path.dirname(browserUnitTestProbe), { recursive: true })
    writeFileSync(browserUnitTestProbe, "test('misplaced', () => {})\n")
  })

  afterAll(() => {
    rmSync(path.dirname(browserUnitTestProbe), {
      recursive: true,
      force: true
    })
  })

  it('reports unit-test filenames in the Playwright test directory', () => {
    const findings = lint(repoConfig, [browserUnitTestProbe]).filter(
      ({ code }) => code === 'comfy(no-unit-test-files-in-browser-tests)'
    )
    expect(findings).toHaveLength(1)
  })
})
