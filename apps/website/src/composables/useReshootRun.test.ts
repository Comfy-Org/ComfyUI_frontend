import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { useReshootRun } from './useReshootRun'

describe('useReshootRun', () => {
  it('adds no take until depth has been read', async () => {
    const scope = effectScope()
    const run = scope.run(() => useReshootRun())
    if (!run) throw new Error('No run')

    const before = run.takes.value.length
    await run.generate()
    expect(run.takes.value).toHaveLength(before)
    expect(run.rendering.value).toBe(false)
    scope.stop()
  })
})
