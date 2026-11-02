import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'unified-report.ts')

function render(args: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'unified-report-'))
  try {
    const result = spawnSync(TSX, [SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      throw new Error(
        `unified-report.ts exited ${result.status}: ${result.stderr}`
      )
    }
    return result.stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('unified-report', () => {
  it('separates each section from the one before it with a blank line', () => {
    const output = render([
      '--size-status=failed',
      '--perf-status=pending',
      '--coverage-status=failed'
    ])

    expect(output).toBe(
      [
        '## 📦 Bundle: ⚠️ Size data collection failed — check the CI workflow logs',
        '',
        '## ⚡ Performance: ⏳ Performance tests in progress…',
        '',
        '## 🔬 E2E Coverage: ⚠️ Coverage collection failed — check the CI workflow logs',
        ''
      ].join('\n')
    )
  })
})
