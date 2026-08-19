// @vitest-environment node

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runOxlint } from './oxlintTestUtil'
import type { OxlintDiagnostic } from './oxlintTestUtil'

const repoConfig = path.resolve('.oxlintrc.json')
const customRulesConfig = path.resolve(
  'tools/oxlint-plugins/customRules.config.json'
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
const computedProbeDir = path.resolve('src/__computed_dom_probes__')

const computedSource = `import { computed } from 'vue'

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

const probes = [
  {
    file: path.join(sourceProbeDir, 'assertion.ts'),
    source:
      'const asserted = value as Error & { code: string }\nvoid asserted\n'
  },
  {
    file: path.join(sourceProbeDir, 'ignored.test.ts'),
    source: 'const asserted = value as Error\nvoid asserted\n'
  },
  {
    file: path.join(appProbeDir, 'assertion.ts'),
    source: 'const asserted = <Error>value\nvoid asserted\n'
  },
  {
    file: path.join(remoteProbeDir, 'zod.ts'),
    source: "import { z } from 'zod'\nexport const schema = z.string()\n"
  },
  {
    file: path.join(remoteProbeDir, 'ignored.test.ts'),
    source: "import { z } from 'zod'\nexport const schema = z.string()\n"
  },
  {
    file: misplacedSpecProbe,
    source: "test('misplaced', () => {})\n"
  },
  {
    file: path.join(fixtureDataProbeDir, 'playwright.ts'),
    source: "import { expect } from '@playwright/test'\nvoid expect\n"
  },
  {
    file: browserUnitTestProbe,
    source: "test('misplaced', () => {})\n"
  },
  {
    file: path.join(computedProbeDir, 'reported.ts'),
    source: computedSource
  },
  {
    file: path.join(computedProbeDir, 'reported.vue'),
    source: `<script setup lang="ts">
import { computed } from 'vue'
computed(() => element.getBoundingClientRect())
</script>
`
  },
  {
    file: path.join(computedProbeDir, 'ignored.test.ts'),
    source:
      "import { computed } from 'vue'\ncomputed(() => element.getBoundingClientRect())\n"
  }
]

describe('restricted syntax rules', () => {
  let findings: readonly OxlintDiagnostic[]

  beforeAll(() => {
    for (const { file, source } of probes) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, source)
    }
    findings = [
      ...runOxlint([
        '--format=json',
        '--config',
        repoConfig,
        sourceProbeDir,
        remoteProbeDir,
        fixtureDataProbeDir,
        browserUnitTestProbe,
        computedProbeDir
      ]),
      ...runOxlint([
        '--format=json',
        '--config',
        customRulesConfig,
        appProbeDir,
        misplacedSpecProbe
      ])
    ]
  })

  afterAll(() => {
    for (const dir of [
      sourceProbeDir,
      appProbeDir,
      remoteProbeDir,
      fixtureDataProbeDir,
      computedProbeDir,
      path.dirname(browserUnitTestProbe)
    ]) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function findingsFor(rule: string) {
    return findings.filter(({ code }) => code === `comfy(${rule})`)
  }

  it('reports both TypeScript assertion forms in source and app files', () => {
    const assertionFindings = findingsFor('no-unsafe-error-assertion')
    expect(assertionFindings).toHaveLength(2)
    expect(
      assertionFindings.some(({ filename }) => filename.includes('apps/'))
    ).toBe(true)
    expect(
      assertionFindings.some(({ filename }) => filename.endsWith('.test.ts'))
    ).toBe(false)
  })

  it('reports Zod imports in remote source but not tests', () => {
    expect(findingsFor('no-new-zod-for-remote-api-types')).toEqual([
      expect.objectContaining({ filename: expect.stringMatching(/zod\.ts$/) })
    ])
  })

  it('reports spec files outside the browser and app e2e directories', () => {
    expect(findingsFor('no-misplaced-spec-files')).toHaveLength(2)
  })

  it('reports Playwright imports in static fixture data', () => {
    expect(findingsFor('no-playwright-imports-in-fixture-data')).toHaveLength(1)
  })

  it('reports unit-test filenames in the Playwright test directory', () => {
    expect(findingsFor('no-unit-test-files-in-browser-tests')).toHaveLength(1)
  })

  it('reports DOM measurement and inspection in computed calls', () => {
    expect(
      findingsFor('no-dom-in-computed').map(({ message }) => message)
    ).toEqual([
      expect.stringContaining('Do not measure the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not inspect the DOM'),
      expect.stringContaining('Do not measure the DOM'),
      expect.stringContaining('Do not measure the DOM')
    ])
  })

  it('preserves computed-rule warning severity and test exclusions', () => {
    const computedFindings = findingsFor('no-dom-in-computed')
    expect(computedFindings).toContainEqual(
      expect.objectContaining({
        filename: expect.stringMatching(/reported\.vue$/),
        message: expect.stringContaining('Do not measure the DOM')
      })
    )
    expect(
      computedFindings.every(({ severity }) => severity === 'warning')
    ).toBe(true)
    expect(
      computedFindings.every(({ filename }) =>
        /reported\.(?:ts|vue)$/.test(filename)
      )
    ).toBe(true)
  })
})
