import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isBlockedThirdPartyLoad,
  reportThirdPartyLoadFailure
} from './thirdPartyLoadFailure'

describe('isBlockedThirdPartyLoad', () => {
  it.for([
    'Failed to fetch dynamically imported module: https://cloud.comfy.org/assets/posthog-js.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Load failed',
    'net::ERR_BLOCKED_BY_CLIENT'
  ])('treats %s as client-blocked', (message) => {
    expect(isBlockedThirdPartyLoad(new TypeError(message))).toBe(true)
  })

  it.for([
    "Cannot read properties of undefined (reading '_s')",
    'Unexpected token < in JSON at position 0',
    'Internal Server Error'
  ])('does not treat %s as client-blocked', (message) => {
    expect(isBlockedThirdPartyLoad(new TypeError(message))).toBe(false)
  })

  it('matches on the error name as well as the message', () => {
    expect(isBlockedThirdPartyLoad(new DOMException('', 'NetworkError'))).toBe(
      true
    )
  })
})

describe('reportThirdPartyLoadFailure', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns without erroring when the client blocked the request', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    reportThirdPartyLoadFailure(
      'PostHog',
      new TypeError('Failed to fetch dynamically imported module: /a.js')
    )

    expect(warn).toHaveBeenCalledOnce()
    expect(error).not.toHaveBeenCalled()
  })

  it('errors for a failure the client did not cause', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    reportThirdPartyLoadFailure('PostHog', new SyntaxError('Unexpected token'))

    expect(error).toHaveBeenCalledWith(
      'Failed to load PostHog:',
      expect.any(SyntaxError)
    )
    expect(warn).not.toHaveBeenCalled()
  })
})
