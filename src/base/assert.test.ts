import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assert, setAssertReporter } from '@/base/assert'

describe('assert', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    setAssertReporter(null)
  })

  it('does nothing when condition is true', () => {
    expect(() => assert(true, 'should not throw')).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('logs console.error when condition is false', () => {
    vi.stubEnv('DEV', false)
    assert(false, 'test message')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Assertion failed]: test message'
    )
  })

  it('throws in DEV mode when condition is false', () => {
    vi.stubEnv('DEV', true)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    expect(() => assert(false, 'dev error')).toThrow(
      '[Assertion failed]: dev error'
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Assertion failed]: dev error'
    )
    expect(reporter).not.toHaveBeenCalled()
  })

  it('does not throw in non-DEV mode when condition is false', () => {
    vi.stubEnv('DEV', false)
    expect(() => assert(false, 'non-dev error')).not.toThrow()
  })

  it('calls registered reporter in non-DEV mode with formatted message', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    assert(false, 'reporter message')
    expect(reporter).toHaveBeenCalledWith(
      '[Assertion failed]: reporter message'
    )
  })

  it('does not call reporter when condition is true', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    assert(true, 'no call')
    expect(reporter).not.toHaveBeenCalled()
  })

  it('handles null reporter gracefully in non-DEV mode', () => {
    vi.stubEnv('DEV', false)
    setAssertReporter(null)
    expect(() => assert(false, 'null reporter')).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Assertion failed]: null reporter'
    )
  })

  it('swallows reporter exceptions in non-DEV mode', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn(() => {
      throw new Error('reporter blew up')
    })
    setAssertReporter(reporter)
    expect(() => assert(false, 'safe under reporter failure')).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Assertion failed]: safe under reporter failure'
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Assertion reporter failed]',
      expect.any(Error)
    )
  })
})
