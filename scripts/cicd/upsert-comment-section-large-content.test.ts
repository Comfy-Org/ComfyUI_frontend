import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

function findOversizedReport() {
  let report = 'x'.repeat(256 * 1024)

  while (report.length <= 16 * 1024 * 1024) {
    const result = spawnSync(process.execPath, ['-e', ''], {
      env: { ...process.env, INPUT_SECTION_CONTENT: report }
    })
    if (result.error?.code === 'E2BIG') {
      return report
    }
    if (result.error) throw result.error
    report += report
  }

  throw new Error('Could not exceed the process environment limit')
}

const tempDirectory = mkdtempSync(join(tmpdir(), 'upsert-comment-section-'))
const reportPath = join(tempDirectory, 'pr-report.md')
const report = findOversizedReport()

writeFileSync(reportPath, report)

afterAll(() => rmSync(tempDirectory, { recursive: true }))

describe('large comment section content', () => {
  it('crosses the process environment limit when passed inline', () => {
    const result = spawnSync(process.execPath, ['-e', ''], {
      env: { ...process.env, INPUT_SECTION_CONTENT: report }
    })

    expect(result.error).toMatchObject({ code: 'E2BIG' })
  })

  it('can be read after process launch when passed by file path', () => {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        "process.stdout.write(require('node:fs').readFileSync(process.env.INPUT_SECTION_CONTENT_FILE, 'utf8'))"
      ],
      {
        env: { ...process.env, INPUT_SECTION_CONTENT_FILE: reportPath },
        maxBuffer: report.length * 2
      }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout.toString()).toBe(readFileSync(reportPath, 'utf8'))
  })
})
