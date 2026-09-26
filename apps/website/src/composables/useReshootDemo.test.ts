import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useReshootDemo } from './useReshootDemo'

describe('useReshootDemo', () => {
  beforeEach(() => vi.useFakeTimers())

  it('adds no take until depth has been read', () => {
    const scope = effectScope()
    const demo = scope.run(() => useReshootDemo())
    if (!demo) throw new Error('No demo')

    const before = demo.takes.value.length
    demo.generate()
    expect(demo.takes.value).toHaveLength(before)

    demo.prepare()
    vi.runAllTimers()
    demo.generate()
    expect(demo.takes.value).toHaveLength(before + 1)
    scope.stop()
  })
})
