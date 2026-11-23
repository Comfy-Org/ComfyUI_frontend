import { describe, expect, it } from 'vitest'

import { runFolderName } from '@e2e/reporters/nodes2Acceptance/reportDir'

describe('runFolderName', () => {
  it('names a run by its local start time down to the second', () => {
    expect(runFolderName(new Date(2026, 10, 3, 9, 5, 7))).toBe(
      '2026-11-03_090507'
    )
  })

  it('gives runs a second apart different folders', () => {
    expect(runFolderName(new Date(2026, 10, 23, 13, 40, 0))).not.toBe(
      runFolderName(new Date(2026, 10, 23, 13, 40, 1))
    )
  })
})
