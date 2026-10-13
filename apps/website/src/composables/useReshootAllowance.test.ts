import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope, ref } from 'vue'

import { useReshootAllowance } from './useReshootAllowance'

describe('useReshootAllowance', () => {
  let scope: EffectScope
  const inScope = <T>(create: () => T): T => {
    const made = scope.run(create)
    if (made === undefined) throw new Error('scope is stopped')
    return made
  }

  beforeEach(() => {
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    localStorage.clear()
  })

  const refuseStorage = () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
  }

  it('shares the count with other tabs through storage', () => {
    const here = inScope(() => useReshootAllowance('generate', 'user-1'))
    const other = inScope(() => useReshootAllowance('generate', 'user-1'))

    other.record()
    here.record()

    expect(here.allowance.value.left).toBe(1)
  })

  it('keeps counting in memory when storage refuses writes', () => {
    refuseStorage()
    const { allowance, record } = inScope(() =>
      useReshootAllowance('generate', 'user-1')
    )

    record()
    record()
    record()

    expect(allowance.value).toMatchObject({ left: 0, runs: 3 })
  })

  it("keeps an owner's in-memory count across a sign-out", async () => {
    refuseStorage()
    const owner = ref<string | undefined>('user-1')
    const { allowance, record } = inScope(() =>
      useReshootAllowance('generate', owner)
    )
    record()
    record()
    record()

    owner.value = undefined
    await Promise.resolve()
    expect(allowance.value.left).toBe(3)
    owner.value = 'user-1'
    await Promise.resolve()

    expect(allowance.value.left).toBe(0)
  })
})
