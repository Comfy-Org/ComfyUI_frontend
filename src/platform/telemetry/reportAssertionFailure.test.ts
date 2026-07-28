import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  addError: vi.fn(),
  getInitConfiguration: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: hoisted
}))

import { reportAssertionFailureToDatadog } from './reportAssertionFailure'

describe('reportAssertionFailureToDatadog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when RUM has not been initialized', () => {
    hoisted.getInitConfiguration.mockReturnValue(undefined)

    reportAssertionFailureToDatadog('[Assertion failed]: whatever')

    expect(hoisted.addError).not.toHaveBeenCalled()
  })

  it('reports the failure as a RUM error when RUM is initialized', () => {
    hoisted.getInitConfiguration.mockReturnValue({})

    reportAssertionFailureToDatadog('[Assertion failed]: invariant broke')

    expect(hoisted.addError).toHaveBeenCalledOnce()
    const [error, context] = hoisted.addError.mock.calls[0]
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('[Assertion failed]: invariant broke')
    expect(context).toEqual({ source: 'assert' })
  })
})
