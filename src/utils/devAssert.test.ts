import { describe, expect, it, vi } from 'vitest'

import { devAssert } from '@/utils/devAssert'

describe('devAssert', () => {
  it('does nothing when condition is true', () => {
    expect(() => devAssert(true, 'should not fire')).not.toThrow()
  })

  it('throws in DEV mode when condition is false', () => {
    expect(() => devAssert(false, 'test failure')).toThrow(
      '[Invariant] test failure'
    )
  })

  it('console.errors in production when condition is false', () => {
    const originalDev = import.meta.env.DEV
    try {
      import.meta.env.DEV = false
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      devAssert(false, 'prod failure')
      expect(spy).toHaveBeenCalledWith('[Invariant] prod failure')
      spy.mockRestore()
    } finally {
      import.meta.env.DEV = originalDev
    }
  })
})
