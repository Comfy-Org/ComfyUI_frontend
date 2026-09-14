import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface Diagnostic {
  readonly code: string
  readonly filename: string
  readonly message: string
  readonly severity: string
}

const probeDirs = {
  source: path.resolve('src/__restricted_syntax_probes__'),
  app: path.resolve('apps/__restricted_syntax_probes__/src'),
  remote: path.resolve('src/platform/remote/__restricted_syntax_probes__'),
  schemas: path.resolve('src/schemas/__restricted_syntax_probes__'),
  fixtureData: path.resolve(
    'browser_tests/fixtures/data/__restricted_syntax_probes__'
  ),
  browserTests: path.resolve('browser_tests/tests/__restricted_syntax_probes__')
}

const probes = [
  {
    file: path.join(probeDirs.source, 'assertion.tsx'),
    source:
      'const asserted = value as Error & { code: string }\nvoid asserted\n'
  },
  {
    file: path.join(probeDirs.app, 'assertion.vue'),
    source: `<script setup lang="ts">
const asserted = value as Error
void asserted
</script>
`
  },
  {
    file: path.join(probeDirs.source, 'ignored.test.ts'),
    source: `const asserted = value as Error
import type { JobId } from '@/schemas/apiSchema'
void asserted
void (0 as unknown as JobId)
`
  },
  {
    file: path.join(probeDirs.source, 'computed.ts'),
    source: `const measured = computed(() => element.getBoundingClientRect())
const styled = computed(() => window.getComputedStyle(element))
const selected = computed(() => element.querySelector('.item'))
const selectedAll = computed(() => element.querySelectorAll('.item'))
const nested = computed(() => () => element.getBoundingClientRect())
const outside = element.getBoundingClientRect()
const dynamic = computed(() => element['querySelector']('.item'))
const unrelated = other(() => element.querySelector('.item'))
void measured
void styled
void selected
void selectedAll
void nested
void outside
void dynamic
void unrelated
`
  },
  {
    file: path.join(probeDirs.source, 'computed.vue'),
    source: `<script setup lang="ts">
computed(() => element.getBoundingClientRect())
</script>
`
  },
  {
    file: path.join(probeDirs.source, 'deprecated.ts'),
    source: `import type { JobId } from '@/schemas/apiSchema'
export { TaskOutput } from '@/schemas/apiSchema'
export * from '@/schemas/apiSchema'
void (0 as unknown as JobId)
`
  },
  {
    file: path.join(probeDirs.source, 'misplaced.spec.ts'),
    source: "test('misplaced', () => {})\n"
  },
  {
    file: path.join(probeDirs.remote, 'remote.ts'),
    source: `import { z } from 'zod'
const asserted = <Error>value
void z
void asserted
`
  },
  {
    file: path.join(probeDirs.remote, 'ignored.test.ts'),
    source: "import { z } from 'zod'\nvoid z\n"
  },
  {
    file: path.join(probeDirs.schemas, 'responseSchema.ts'),
    source: `import { z } from 'zod'
export { ZodError } from 'zod'
export * from 'zod'
void z
`
  },
  {
    file: path.join(probeDirs.schemas, 'ignored.test.ts'),
    source: "import { z } from 'zod'\nvoid z\n"
  },
  {
    file: path.join(probeDirs.fixtureData, 'playwright.ts'),
    source: "import { expect } from '@playwright/test'\nvoid expect\n"
  },
  {
    file: path.join(probeDirs.browserTests, 'misplaced.test.ts'),
    source: "test('misplaced', () => {})\n"
  },
  {
    file: path.join(probeDirs.browserTests, 'allowed.spec.ts'),
    source: "test('allowed', () => {})\n"
  }
]

function hasStringProperty(value: object, property: keyof Diagnostic): boolean {
  if (!(property in value)) return false
  return typeof Reflect.get(value, property) === 'string'
}

function isDiagnostic(value: unknown): value is Diagnostic {
  if (typeof value !== 'object' || value === null) return false
  return (['code', 'filename', 'message', 'severity'] as const).every(
    (property) => hasStringProperty(value, property)
  )
}

function parseDiagnostics(output: string): Diagnostic[] {
  const report: unknown = JSON.parse(output)
  if (
    typeof report !== 'object' ||
    report === null ||
    !('diagnostics' in report) ||
    !Array.isArray(report.diagnostics)
  ) {
    throw new Error('Oxlint returned an invalid JSON report')
  }
  if (!report.diagnostics.every(isDiagnostic)) {
    throw new Error('Oxlint returned diagnostics in an unexpected shape')
  }
  return report.diagnostics
}

describe('restricted syntax rules', () => {
  let findings: Diagnostic[]

  beforeAll(() => {
    for (const { file, source } of probes) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, source)
    }

    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/oxlint/bin/oxlint'),
        '--format=json',
        '--config',
        path.resolve('.oxlintrc.json'),
        ...Object.values(probeDirs)
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    if (result.error) throw result.error
    if (!result.stdout.trim()) {
      throw new Error(
        `Oxlint produced no JSON report (status ${result.status}): ${result.stderr}`
      )
    }
    findings = parseDiagnostics(result.stdout)
  })

  afterAll(() => {
    for (const dir of Object.values(probeDirs)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function findingsFor(rule: string) {
    return findings.filter(({ code }) => code === `comfy(${rule})`)
  }

  it('preserves Error assertion scope across source and remote files', () => {
    const assertionFindings = findingsFor('no-unsafe-error-assertion')
    expect(assertionFindings).toHaveLength(3)
    expect(
      assertionFindings.every(({ severity }) => severity === 'error')
    ).toBe(true)
    expect(
      assertionFindings.some(({ filename }) =>
        filename.replaceAll('\\', '/').includes('apps/')
      )
    ).toBe(true)
    expect(
      assertionFindings.some(({ filename }) => filename.endsWith('.test.ts'))
    ).toBe(false)
    expect(new Set(assertionFindings.map(({ message }) => message))).toEqual(
      new Set([
        'Do not use Error type assertions. Use `instanceof Error` narrowing or `toError()` from @/utils/errorUtil instead. See issue #11429.'
      ])
    )
  })

  it('reports only static DOM access nested inside computed calls', () => {
    const computedFindings = findingsFor('no-dom-in-computed')
    expect(computedFindings).toHaveLength(6)
    expect(
      computedFindings.every(({ severity }) => severity === 'warning')
    ).toBe(true)
    expect(
      computedFindings.filter(({ message }) =>
        message.startsWith('Do not measure the DOM')
      )
    ).toHaveLength(3)
    expect(new Set(computedFindings.map(({ message }) => message))).toEqual(
      new Set([
        'Do not measure the DOM inside a computed - every recompute becomes a layout read. Derive from a store instead. See docs/guidance/state-and-effects.md.',
        'Do not inspect the DOM inside a computed. Derive from a store instead. See docs/guidance/state-and-effects.md.'
      ])
    )
  })

  it('preserves the remote Zod and browser test restrictions', () => {
    expect(findingsFor('no-new-zod-for-remote-api-types')).toEqual([
      expect.objectContaining({
        message:
          'Do not hand-write new Zod schemas for remote API types. Use generated types from packages/ingest-types (@comfyorg/ingest-types) instead. See browser_tests/README.md "Sources of truth for mock types".',
        severity: 'error'
      })
    ])
    expect(findingsFor('no-playwright-imports-in-fixture-data')).toEqual([
      expect.objectContaining({
        message:
          'fixtures/data/ must contain only static data. No Playwright imports allowed.',
        severity: 'error'
      })
    ])
    expect(findingsFor('no-unit-test-files-in-browser-tests')).toEqual([
      expect.objectContaining({
        message:
          '.test.ts files are not allowed in browser_tests/tests/; use .spec.ts instead',
        severity: 'error'
      })
    ])
    expect(findingsFor('no-misplaced-spec-files')).toEqual([
      expect.objectContaining({
        message:
          '.spec.ts files are only allowed under browser_tests/tests/ or apps/*/e2e/',
        severity: 'error'
      })
    ])
  })

  it('preserves warning policies added after the original PR', () => {
    const apiSchemaFindings = findingsFor('no-deprecated-api-schema')
    const zodSchemaFindings = findingsFor('no-new-zod-server-response-schema')
    expect(apiSchemaFindings).toHaveLength(3)
    expect(zodSchemaFindings).toHaveLength(3)
    expect(
      [...apiSchemaFindings, ...zodSchemaFindings].every(
        ({ severity }) => severity === 'warning'
      )
    ).toBe(true)
    expect(new Set(apiSchemaFindings.map(({ message }) => message))).toEqual(
      new Set([
        'apiSchema is deprecated. Use generated types from @comfyorg/ingest-types instead. Only keep a hand-written schema if the ComfyUI webserver clearly diverges from the cloud ingest spec.'
      ])
    )
    expect(new Set(zodSchemaFindings.map(({ message }) => message))).toEqual(
      new Set([
        'Avoid introducing new hand-written zod schemas under src/schemas/ for server responses. Use generated types from @comfyorg/ingest-types instead. Only keep a hand-written schema if the ComfyUI webserver clearly diverges from the cloud ingest spec.'
      ])
    )
  })
})
