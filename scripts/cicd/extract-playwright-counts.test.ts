import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  JSONReport,
  JSONReportSpec,
  JSONReportSuite,
  JSONReportTest
} from '@playwright/test/reporter'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'extract-playwright-counts.ts')
const BASE_URL = 'https://abc.chromium.pages.dev'
const FILE = 'tests/save.spec.ts'

type SpecFixture = Pick<JSONReportSpec, 'id' | 'title' | 'file'> & {
  tests: Pick<JSONReportTest, 'status' | 'projectName'>[]
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
  return { id, title, file: FILE, tests: [{ status, projectName: 'chromium' }] }
}

function stats(
  counts: Pick<
    JSONReport['stats'],
    'expected' | 'unexpected' | 'flaky' | 'skipped'
  >
): JSONReport['stats'] {
  return { startTime: '2026-10-29T00:00:00.000Z', duration: 1, ...counts }
}

function extract(report: ReportFixture, baseUrl = BASE_URL) {
  const dir = mkdtempSync(join(tmpdir(), 'extract-playwright-counts-'))
  try {
    writeFileSync(join(dir, 'report.json'), JSON.stringify(report))
    const run = spawnSync(TSX, [SCRIPT, dir, baseUrl], { encoding: 'utf8' })
    if (run.status !== 0) {
      throw new Error(`extractor exited ${run.status}: ${run.stderr}`)
    }
    return JSON.parse(run.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
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
        traceUrl: `${BASE_URL}/#?testId=fail-1`
      }
    ])
  })

  it('keeps the report path when the report has no config file', () => {
    const noConfigFile = { ...mixedReport, config: { rootDir: '/elsewhere' } }

    expect(extract(noConfigFile).failures[0].file).toBe(FILE)
  })

  it('omits the report link when the report was not deployed', () => {
    expect(extract(mixedReport, 'failed').failures[0].traceUrl).toBeUndefined()
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
      })
    ).toMatchObject({ passed: 1, failed: 0, flaky: 1, total: 2, failures: [] })
  })
})
