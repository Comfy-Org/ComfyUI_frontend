import { afterEach, describe, expect, it, vi } from 'vitest'

import { useReshootAllowance } from './useReshootAllowance'

describe('useReshootAllowance', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('shares the count with other tabs through storage', () => {
    const here = useReshootAllowance('generate', 'user-1')
    const other = useReshootAllowance('generate', 'user-1')

    other.record()
    here.record()

    expect(here.allowance.value.left).toBe(1)
  })

  it('keeps counting in memory when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { allowance, record } = useReshootAllowance('generate', 'user-1')

    record()
    record()
    record()

    expect(allowance.value).toMatchObject({ left: 0, runs: 3 })
  })
})
