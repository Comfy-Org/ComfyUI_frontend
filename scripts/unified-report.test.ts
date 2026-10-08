import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')
const SCRIPT = join(import.meta.dirname, 'unified-report.ts')

function renderWithoutSizeData(sizeStatus: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'unified-report-'))
  try {
    const result = spawnSync(
      TSX,
      [SCRIPT, `--size-status=${sizeStatus}`, '--perf-status=skip'],
      { cwd, encoding: 'utf8' }
    )
    if (result.status !== 0) {
      throw new Error(
        `unified-report.ts exited ${result.status}: ${result.stderr}`
      )
    }
    return result.stdout
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe('unified-report bundle size section', () => {
  it.for(['skip', 'ready'])('is omitted for size status %s', (sizeStatus) => {
    expect(renderWithoutSizeData(sizeStatus)).not.toContain('Bundle Size')
  })

  it.for([
    { sizeStatus: 'pending', message: 'Size data collection in progress' },
    { sizeStatus: 'failed', message: 'Size data collection failed' }
  ])(
    'says "$message" for size status $sizeStatus',
    ({ sizeStatus, message }) => {
      const output = renderWithoutSizeData(sizeStatus)

      expect(output).toContain('## 📦 Bundle Size')
      expect(output).toContain(message)
    }
  )
})
