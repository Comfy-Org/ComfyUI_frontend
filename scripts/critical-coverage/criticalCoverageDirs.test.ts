import { describe, expect, it } from 'vitest'

import { isCriticalCoveragePath } from './criticalCoverageDirs'

describe('isCriticalCoveragePath', () => {
  it('matches critical directories and their descendants', () => {
    expect(isCriticalCoveragePath('src/stores')).toBe(true)
    expect(isCriticalCoveragePath('src/stores/queueStore.ts')).toBe(true)
  })

  it('does not match similarly prefixed or unrelated paths', () => {
    expect(isCriticalCoveragePath('src/stores-old/queueStore.ts')).toBe(false)
    expect(isCriticalCoveragePath('src/components/QueuePanel.vue')).toBe(false)
  })
})
