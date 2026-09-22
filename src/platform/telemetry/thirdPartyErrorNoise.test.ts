import { describe, expect, it } from 'vitest'

import {
  isThirdPartyErrorNoise,
  sentryThirdPartyErrorFilter
} from './thirdPartyErrorNoise'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'

describe('third-party error noise', () => {
  it.for([
    EXTENSION_ERROR,
    `Error: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: ${EXTENSION_ERROR}`
  ])('identifies the extension tab error in %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(true)
  })

  it.for([
    'Invalid call to runtime.sendMessage(). Receiving end does not exist.',
    `Application failed: ${EXTENSION_ERROR}`
  ])('does not suppress %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(false)
  })

  it.for([
    {
      event: {},
      hint: { originalException: new Error(EXTENSION_ERROR) }
    },
    {
      event: { message: `Error: ${EXTENSION_ERROR}` },
      hint: {}
    },
    {
      event: { exception: { values: [{ value: EXTENSION_ERROR }] } },
      hint: {}
    }
  ])('drops the extension error from Sentry', ({ event, hint }) => {
    expect(sentryThirdPartyErrorFilter(event, hint)).toBeNull()
  })

  it('keeps ordinary Sentry events unchanged', () => {
    const event = {
      exception: { values: [{ value: 'Application failed' }] }
    }

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })
})
