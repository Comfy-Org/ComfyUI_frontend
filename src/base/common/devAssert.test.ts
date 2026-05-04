import { beforeEach, describe, expect, it, vi } from 'vitest'

import { devAssert, setDevAssertReporter } from '@/base/common/devAssert'

describe('devAssert', () => {
  beforeEach(() => {
    setDevAssertReporter(undefined as never)
  })

  it('does nothing when condition is true', () => {
    expect(() => devAssert(true, 'should not fire')).not.toThrow()
  })

  it('throws in DEV mode when condition is false', () => {
    expect(() => devAssert(false, 'test failure')).toThrow(
      '[Invariant] test failure'
    )
  })

  it('always console.errors when condition is false', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      devAssert(false, 'error msg')
    } catch {
      // expected in DEV
    }
    expect(spy).toHaveBeenCalledWith('[Invariant] error msg')
    spy.mockRestore()
  })

  it('calls reporter when set', () => {
    const reporter = vi.fn()
    setDevAssertReporter(reporter)
    try {
      devAssert(false, 'reported msg')
    } catch {
      // expected in DEV
    }
    expect(reporter).toHaveBeenCalledWith('[Invariant] reported msg')
  })

  it('does not call reporter when condition is true', () => {
    const reporter = vi.fn()
    setDevAssertReporter(reporter)
    devAssert(true, 'should not fire')
    expect(reporter).not.toHaveBeenCalled()
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
