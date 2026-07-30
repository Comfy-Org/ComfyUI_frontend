import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useSmoothedRect } from './useSmoothedRect'

const rect = (x: number) => new DOMRect(x, 0, 100, 50)

function setup(initial: DOMRect | null) {
  const scope = effectScope()
  const target = ref<DOMRect | null>(initial)
  const drawn = scope.run(() => useSmoothedRect(target))!
  return { scope, target, drawn }
}

describe('useSmoothedRect', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })
  )
  afterEach(() => vi.useRealTimers())

  it('snaps on first appearance and on target loss', async () => {
    const { scope, target, drawn } = setup(null)
    target.value = rect(100)
    await nextTick()
    expect(drawn.value).toBe(target.value)

    target.value = null
    await nextTick()
    expect(drawn.value).toBeNull()
    scope.stop()
  })

  it('eases toward a jumped target and settles exactly on it', async () => {
    const { scope, target, drawn } = setup(rect(0))
    target.value = rect(300)
    await nextTick()

    vi.advanceTimersToNextFrame()
    const partway = drawn.value!.x
    expect(partway).toBeGreaterThan(0)
    expect(partway).toBeLessThan(300)

    for (let i = 0; i < 120; i++) vi.advanceTimersToNextFrame()
    expect(drawn.value!.x).toBe(300)
    scope.stop()
  })
})
