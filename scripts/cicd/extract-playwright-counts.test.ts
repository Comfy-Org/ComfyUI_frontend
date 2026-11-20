import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  JSONReport,
  JSONReportSpec,
  JSONReportSuite,
  JSONReportTest
} from '@playwright/test/reporter'
import { describe, expect, it, onTestFinished } from 'vitest'

const ROOT = join(import.meta.dirname, '../..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'extract-playwright-counts.ts')
const BASE_URL = 'https://abc.chromium.pages.dev'
const FILE = 'tests/save.spec.ts'

type SpecFixture = Pick<JSONReportSpec, 'id' | 'title' | 'file'> & {
  tests: Pick<JSONReportTest, 'status'>[]
}

type SuiteFixture = Pick<JSONReportSuite, 'title' | 'file'> & {
  specs: SpecFixture[]
  suites?: SuiteFixture[]
}

interface ReportFixture {
  config?: Partial<Pick<JSONReport['config'], 'rootDir' | 'configFile'>>
  stats: JSONReport['stats']
  suites: SuiteFixture[]
}

function spec(
  id: string,
  title: string,
  status: JSONReportTest['status']
): SpecFixture {
  return { id, title, file: FILE, tests: [{ status }] }
}

function stats(
  counts: Pick<
    JSONReport['stats'],
    'expected' | 'unexpected' | 'flaky' | 'skipped'
  >
): JSONReport['stats'] {
  return { startTime: '2026-10-29T00:00:00.000Z', duration: 1, ...counts }
}

function runExtractor(
  files: Record<string, string>,
  baseUrl = BASE_URL,
  testRoot?: string
) {
  const dir = mkdtempSync(join(tmpdir(), 'extract-playwright-counts-'))
  try {
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(dir, name), content)
    const argv = testRoot
      ? [SCRIPT, dir, baseUrl, testRoot]
      : [SCRIPT, dir, baseUrl]
    const run = spawnSync(TSX, argv, { encoding: 'utf8' })
    if (run.status !== 0) {
      throw new Error(`extractor exited ${run.status}: ${run.stderr}`)
    }
    return { counts: JSON.parse(run.stdout) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function extract(report: unknown, baseUrl = BASE_URL, testRoot?: string) {
  return runExtractor(
    { 'report.json': JSON.stringify(report) },
    baseUrl,
    testRoot
  ).counts
}

function failing(...specs: SpecFixture[]): ReportFixture {
  return {
    stats: stats({
      expected: 0,
      unexpected: specs.length,
      flaky: 0,
      skipped: 0
    }),
    suites: [{ title: FILE, file: FILE, specs }]
  }
}

const mixedReport: ReportFixture = {
  config: {
    rootDir: '/__w/ComfyUI_frontend/ComfyUI_frontend/browser_tests',
    configFile: '/__w/ComfyUI_frontend/ComfyUI_frontend/playwright.config.ts'
  },
  stats: stats({ expected: 3, unexpected: 1, flaky: 1, skipped: 1 }),
  suites: [
    {
      title: FILE,
      file: FILE,
      specs: [spec('pass-1', 'opens the menu', 'expected')],
      suites: [
        {
          title: 'Save',
          file: FILE,
          specs: [
            spec('fail-1', 'saves a workflow', 'unexpected'),
            spec('flaky-1', 'recovers on retry', 'flaky'),
            spec('skip-1', 'is skipped', 'skipped')
          ]
        }
      ]
    }
  ]
}

describe('extract-playwright-counts on a Playwright JSON report', () => {
  it('counts each outcome once, as Playwright reports them', () => {
    expect(extract(mixedReport)).toMatchObject({
      passed: 3,
      failed: 1,
      flaky: 1,
      skipped: 1,
      total: 6
    })
  })

  it('names each failed test with its repository path and report link', () => {
    expect(extract(mixedReport).failures).toEqual([
      {
        name: `${FILE} › Save › saves a workflow`,
        file: `browser_tests/${FILE}`,
        reportUrl: `${BASE_URL}/#?testId=fail-1`
      }
    ])
  })

  it('keeps the report path when neither the report nor the caller maps it', () => {
    const noConfigFile = { ...mixedReport, config: { rootDir: '/elsewhere' } }

    expect(extract(noConfigFile).failures[0].file).toBe(FILE)
  })

  it('uses the test root the caller supplies when the report omits its config file', () => {
    const noConfigFile = { ...mixedReport, config: { rootDir: '/elsewhere' } }

    expect(
      extract(noConfigFile, BASE_URL, 'browser_tests').failures[0].file
    ).toBe(`browser_tests/${FILE}`)
  })

  it('prefers the test root the report states over the supplied one', () => {
    expect(extract(mixedReport, BASE_URL, 'elsewhere').failures[0].file).toBe(
      `browser_tests/${FILE}`
    )
  })

  it('omits the report link when the report was not deployed', () => {
    expect(extract(mixedReport, 'failed').failures[0].reportUrl).toBeUndefined()
  })

  it('lists no failures when tests only failed before passing on retry', () => {
    expect(
      extract({
        stats: stats({ expected: 1, unexpected: 0, flaky: 1, skipped: 0 }),
        suites: [
          {
            title: FILE,
            file: FILE,
            specs: [spec('flaky-1', 'recovers on retry', 'flaky')]
          }
        ]
      }).failures
    ).toEqual([])
  })

  it('caps the failure list so the PR comment stays within its size limit', () => {
    const specs = Array.from({ length: 30 }, (_, i) =>
      spec(`f${i}`, `case ${i}`, 'unexpected')
    )
    const counts = extract(failing(...specs))

    expect(counts.failed).toBe(30)
    expect(counts.failures).toHaveLength(20)
  })

  it('bounds the listed characters, not only the number of entries', () => {
    const specs = Array.from({ length: 20 }, (_, i) =>
      spec(`f${i}`, 'x'.repeat(70_000), 'unexpected')
    )
    const counts = extract(failing(...specs))
    const listed = counts.failures.reduce(
      (chars: number, failure: { name: string; file: string }) =>
        chars + failure.name.length + failure.file.length,
      0
    )

    expect(counts.failed).toBe(20)
    expect(listed).toBeLessThan(5000)
  })

  it('keeps the counts when a spec is malformed', () => {
    const malformed = { id: 'x', title: 'broken', file: FILE, tests: 'none' }

    expect(
      extract({
        ...failing(spec('fail-1', 'saves', 'unexpected')),
        suites: [{ title: FILE, specs: [malformed] }]
      })
    ).toMatchObject({ failed: 1, total: 1, failures: [] })
  })
})

describe('extract-playwright-counts on untrusted report content', () => {
  it('counts only non-negative integers', () => {
    expect(
      extract({
        stats: {
          expected: 'a[$(touch pwned)]',
          unexpected: -2,
          flaky: 1.5,
          skipped: 2
        },
        suites: []
      })
    ).toMatchObject({ passed: 0, failed: 0, flaky: 0, skipped: 2, total: 2 })
  })

  it('strips characters that break the comment script or its markdown', () => {
    const [failure] = extract(
      failing({
        ...spec(
          '../x?y',
          'a|b\nc [x](https://evil) <!-- section:z:end --> @team',
          'unexpected'
        ),
        file: 'tests/a|b\n.spec.ts'
      })
    ).failures

    expect(failure.name).not.toMatch(/[|\n\r<>[\]]/)
    expect(failure.name).toContain('@\u200bteam')
    expect(failure.file).not.toMatch(/[|\n\r]/)
    expect(failure.reportUrl).toBe(`${BASE_URL}/#?testId=..%2Fx%3Fy`)
  })

  it('never evaluates script embedded in an HTML report', () => {
    const marker = join(tmpdir(), `extract-playwright-${process.pid}-pwned`)
    onTestFinished(() => rmSync(marker, { force: true }))
    const { counts } = runExtractor({
      'index.html': `<script>window.playwrightReport = {stats: (() => { process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(marker)}, ''); return { expected: 1 } })()};</script>`
    })

    expect(existsSync(marker)).toBe(false)
    expect(counts.total).toBe(0)
  })
})

describe('extract-playwright-counts on an HTML report without report.json', () => {
  it.for([
    {
      format: 'embedded base64 report',
      html: `<script>window.playwrightReportBase64 = "${Buffer.from(
        JSON.stringify({
          stats: { expected: 4, unexpected: 1, flaky: 0, skipped: 1 }
        })
      ).toString('base64')}"</script>`
    },
    {
      format: 'embedded JSON report',
      html: '<script>window.playwrightReport = {"stats": {"expected": 4, "unexpected": 1, "flaky": 0, "skipped": 1}};</script>'
    },
    {
      format: 'rendered stats',
      html: '<div>4 passed · 1 failed · 0 flaky · 1 skipped</div>'
    },
    {
      format: 'summary text',
      html: '<p>4 tests passed</p><p>1 test failed</p><p>1 test skipped</p>'
    }
  ])('reads the counts from the $format', ({ html }) => {
    expect(runExtractor({ 'index.html': html }).counts).toMatchObject({
      passed: 4,
      failed: 1,
      flaky: 0,
      skipped: 1,
      total: 6
    })
  })

  it.for([
    {
      format: 'rendered stats',
      html: '<div>9999999999999999999999999 passed · 1 failed · 0 flaky · 0 skipped</div>'
    },
    {
      format: 'summary text',
      html: '<p>9999999999999999999999999 tests passed</p><p>1 test failed</p>'
    }
  ])('ignores counts too large to be exact in $format', ({ html }) => {
    expect(runExtractor({ 'index.html': html }).counts).toMatchObject({
      passed: 0,
      failed: 1,
      total: 1
    })
  })
})
