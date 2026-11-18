import { describe, expect, it } from 'vitest'
import { effectScope, ref, watchSyncEffect } from 'vue'

import { useKeyedMembership } from '@/platform/workflowErrors/keyedMembership'

describe('useKeyedMembership', () => {
  function setup(initial: string[]) {
    const keys = ref(new Set(initial))
    const scope = effectScope()
    const has = scope.run(() => useKeyedMembership(() => keys.value))!
    return { keys, has, scope }
  }

  it('reports the keys of the current set', () => {
    const { keys, has } = setup(['a'])

    expect(has('a')).toBe(true)
    expect(has('b')).toBe(false)

    keys.value = new Set(['b'])

    expect(has('a')).toBe(false)
    expect(has('b')).toBe(true)
  })

  it('re-runs a reader only when its own key changes', () => {
    const { keys, has, scope } = setup(['a'])
    let runs = 0
    scope.run(() =>
      watchSyncEffect(() => {
        has('a')
        runs++
      })
    )
    expect(runs).toBe(1)

    keys.value = new Set(['a', 'b'])
    keys.value = new Set(['a', 'c'])
    expect(runs).toBe(1)

    keys.value = new Set(['c'])
    expect(runs).toBe(2)
  })
})
