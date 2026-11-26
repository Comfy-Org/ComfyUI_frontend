import path from 'node:path'

import { assert, describe, expect, it, vi } from 'vitest'

import { runFolderName } from '@e2e/reporters/nodes2Acceptance/reportDir'

describe('runFolderName', () => {
  it('names a run by its local start time down to the second', () => {
    expect(runFolderName(new Date(2026, 10, 3, 9, 5, 7))).toBe(
      '2026-11-03_090507'
    )
  })

  it('shares an implicit run with workers and separates independent starts in the same second', async () => {
    vi.stubEnv('NODES2_ACCEPTANCE_REPORT_DIR', undefined)
    vi.stubEnv('NODES2_ACCEPTANCE_RUN', undefined)
    vi.setSystemTime(new Date(2026, 10, 23, 13, 40, 0))
    vi.resetModules()
    const first = await import('@e2e/reporters/nodes2Acceptance/reportDir')
    const inheritedRun = process.env.NODES2_ACCEPTANCE_RUN
    assert.isDefined(inheritedRun)
    expect(first.REPORT_DIR).toBe(path.join(first.REPORT_ROOT, inheritedRun))
    vi.resetModules()
    const worker = await import('@e2e/reporters/nodes2Acceptance/reportDir')
    expect(worker.REPORT_DIR).toBe(first.REPORT_DIR)
    vi.stubEnv('NODES2_ACCEPTANCE_RUN', undefined)
    vi.resetModules()
    const independent =
      await import('@e2e/reporters/nodes2Acceptance/reportDir')
    expect(independent.REPORT_DIR).not.toBe(first.REPORT_DIR)
  })

  it.for([
    {
      run: 'grouped',
      override: undefined,
      expected: path.join('nodes2-acceptance-report', 'grouped')
    },
    { run: 'grouped', override: 'external/report', expected: 'external/report' }
  ])(
    'preserves explicit grouping and output override $override',
    async ({ run, override, expected }) => {
      vi.stubEnv('NODES2_ACCEPTANCE_RUN', run)
      vi.stubEnv('NODES2_ACCEPTANCE_REPORT_DIR', override)
      vi.resetModules()
      const { REPORT_DIR } =
        await import('@e2e/reporters/nodes2Acceptance/reportDir')
      expect(REPORT_DIR).toBe(expected)
    }
  )
})
