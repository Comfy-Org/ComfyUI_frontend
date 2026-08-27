import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { writePerfReport } from '@e2e/fixtures/utils/perfReporter'

function withTemporaryWorkingDirectory(run: () => void): void {
  const originalDirectory = process.cwd()
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'perf-reporter-'))
  process.chdir(temporaryDirectory)
  try {
    mkdirSync(join('test-results', 'perf-temp'), { recursive: true })
    run()
  } finally {
    process.chdir(originalDirectory)
    rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}

describe('performance reporter', () => {
  it('fails when every recorded measurement is invalid', () => {
    withTemporaryWorkingDirectory(() => {
      writeFileSync(
        join('test-results', 'perf-temp', 'invalid.json'),
        JSON.stringify({ kind: 'accepted', measurement: { name: 'invalid' } })
      )

      expect(() => writePerfReport()).toThrow(
        'All 1 recorded performance measurements were invalid'
      )
    })
  })
})
