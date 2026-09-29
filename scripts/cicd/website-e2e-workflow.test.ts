import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

const ROOT = join(import.meta.dirname, '../..')
const PREPARE_REPORT = join(
  import.meta.dirname,
  'prepare-website-e2e-report.sh'
)
const CHECK_RESULT = join(import.meta.dirname, 'check-website-e2e-result.sh')

function reportFixture() {
  const root = mkdtempSync(join(tmpdir(), 'website-e2e-report-'))
  const reports = join(root, 'reports')
  const bin = join(root, 'bin')
  const output = join(root, 'github-output')
  mkdirSync(reports)
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$CALLS"
[[ "\${MERGE_REPORTS_OK:-true}" == true ]]
`,
    { mode: 0o755 }
  )

  return {
    root,
    reports,
    output,
    addReports(count: number) {
      for (let index = 0; index < count; index++)
        writeFileSync(join(reports, `${index}.zip`), '')
    },
    run(
      options: {
        download?: string
        mergeReports?: string
        shards?: string
      } = {}
    ) {
      const calls = join(root, 'calls')
      writeFileSync(calls, '')
      const result = spawnSync(
        'bash',
        [PREPARE_REPORT, reports, '4', '1.61.1'],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            BLOB_REPORTS_OUTCOME: options.download ?? 'success',
            SHARDS_RESULT: options.shards ?? 'success',
            MERGE_REPORTS_OK: options.mergeReports ?? 'true',
            GITHUB_OUTPUT: output,
            CALLS: calls
          }
        }
      )
      return {
        status: result.status,
        output: readFileSync(output, 'utf8'),
        calls: readFileSync(calls, 'utf8')
      }
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

function checkResult(env: Record<string, string>) {
  return spawnSync('bash', [CHECK_RESULT], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  })
}

describe('website E2E workflow', () => {
  it('merges every blob before reporting successful tests', () => {
    using fixture = reportFixture()
    fixture.addReports(4)

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.output).toBe('result=success\n')
    expect(result.calls).toContain('@playwright/test@1.61.1')
    expect(result.calls).toContain('--reporter=html')
    expect(result.calls).toContain('--reporter=json')
  })

  it('preserves a complete failing test run', () => {
    using fixture = reportFixture()
    fixture.addReports(4)

    expect(fixture.run({ shards: 'failure' }).output).toBe('result=failure\n')
  })

  it('reports infrastructure failure for incomplete artifacts', () => {
    using failedDownload = reportFixture()
    failedDownload.addReports(4)
    using missingReport = reportFixture()
    missingReport.addReports(3)

    expect(failedDownload.run({ download: 'failure' }).output).toBe(
      'result=infrastructure\n'
    )
    expect(missingReport.run().output).toBe('result=infrastructure\n')
  })

  it('reports infrastructure failure when report generation fails', () => {
    using fixture = reportFixture()
    fixture.addReports(4)

    expect(fixture.run({ mergeReports: 'false' }).output).toBe(
      'result=infrastructure\n'
    )
  })

  it('keeps the matrix and completeness check synchronized', () => {
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/ci-website-e2e.yaml'),
      'utf8'
    )

    expect(workflow).toContain('shardTotal: [4]')
    expect(workflow).toContain(
      'prepare-website-e2e-report.sh all-blob-reports 4 "$PLAYWRIGHT_VERSION"'
    )
  })

  it('runs the required gate with change detection even when a dependency fails', () => {
    const workflow = parseDocument(
      readFileSync(join(ROOT, '.github/workflows/ci-website-e2e.yaml'), 'utf8')
    ).toJS()

    expect(workflow).toMatchObject({
      jobs: {
        'website-e2e': {
          if: '${{ always() }}',
          needs: ['changes', 'website-e2e-shard', 'website-e2e-report'],
          steps: expect.arrayContaining([
            expect.objectContaining({
              env: expect.objectContaining({
                CHANGES_RESULT: '${{ needs.changes.result }}'
              })
            })
          ])
        }
      }
    })
  })

  it.for`
    changes        | shouldRun  | shard        | report       | outcome             | status
    ${'success'}   | ${'true'}  | ${'success'} | ${'success'} | ${'success'}        | ${0}
    ${'success'}   | ${'false'} | ${'skipped'} | ${'skipped'} | ${''}               | ${0}
    ${'failure'}   | ${''}      | ${'skipped'} | ${'skipped'} | ${''}               | ${1}
    ${'cancelled'} | ${''}      | ${'skipped'} | ${'skipped'} | ${''}               | ${1}
    ${'failure'}   | ${'false'} | ${'skipped'} | ${'skipped'} | ${''}               | ${1}
    ${'success'}   | ${''}      | ${'skipped'} | ${'skipped'} | ${''}               | ${1}
    ${'success'}   | ${'false'} | ${'failure'} | ${'skipped'} | ${''}               | ${1}
    ${'success'}   | ${'true'}  | ${'skipped'} | ${'skipped'} | ${''}               | ${1}
    ${'success'}   | ${'true'}  | ${'failure'} | ${'success'} | ${'failure'}        | ${1}
    ${'success'}   | ${'true'}  | ${'success'} | ${'failure'} | ${''}               | ${1}
    ${'success'}   | ${'true'}  | ${'success'} | ${'success'} | ${'infrastructure'} | ${1}
  `(
    'gate exits $status for changes=$changes, shouldRun=$shouldRun, shard=$shard, report=$report, outcome=$outcome',
    ({ changes, shouldRun, shard, report, outcome, status }) => {
      expect(
        checkResult({
          CHANGES_RESULT: changes,
          SHOULD_RUN: shouldRun,
          SHARD_RESULT: shard,
          REPORT_RESULT: report,
          TEST_OUTCOME: outcome
        }).status
      ).toBe(status)
    }
  )
})
