import { describe, expect, it, vi } from 'vitest'

import {
  isThirdPartyErrorNoise,
  redactSensitiveText,
  stripUrlQuery
} from './telemetry'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'

describe('isThirdPartyErrorNoise', () => {
  it.for([
    EXTENSION_ERROR,
    `Error: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: Error: ${EXTENSION_ERROR}`,
    `${EXTENSION_ERROR} extension context`
  ])('identifies the extension tab error in %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(true)
  })

  it.for([
    'Invalid call to runtime.sendMessage(). Receiving end does not exist.',
    `Application failed: ${EXTENSION_ERROR}`
  ])('does not suppress %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(false)
  })
})

describe('stripUrlQuery', () => {
  it.for([
    {
      url: 'https://billing.comfy.org/v1/checkout?promo=SPRING',
      expected: 'https://billing.comfy.org/v1/checkout'
    },
    {
      url: 'https://billing.comfy.org/v1/checkout#summary',
      expected: 'https://billing.comfy.org/v1/checkout'
    },
    {
      url: 'https://billing.comfy.org/v1/checkout',
      expected: 'https://billing.comfy.org/v1/checkout'
    }
  ])('keeps only the origin and path of $url', ({ url, expected }) => {
    expect(stripUrlQuery(url)).toBe(expected)
  })
})

describe('redactSensitiveText', () => {
  it.for([
    {
      text: 'a@b.co,c.d@e.org;first.last+tag@sub.example.io',
      expected: '[email],[email];[email]'
    },
    {
      text: 'GET https://cloud.comfy.org/api/u/ada%40example.com failed',
      expected: 'GET https://cloud.comfy.org/api/u/[email] failed'
    },
    {
      text: 'at fn@https://billing.comfy.org/assets/index.js:1:2',
      expected: 'at fn@https://billing.comfy.org/assets/index.js:1:2'
    },
    {
      text: 'at /node_modules/@datadog/browser-rum/index.js:3:4',
      expected: 'at /node_modules/@datadog/browser-rum/index.js:3:4'
    }
  ])('rewrites "$text"', ({ text, expected }) => {
    expect(redactSensitiveText(text)).toBe(expected)
  })

  it('scans a long run of characters an email could start with in linear time', () => {
    vi.useRealTimers()
    const text = 'a.'.repeat(25_000)

    const started = performance.now()
    redactSensitiveText(text)

    expect(performance.now() - started).toBeLessThan(250)
  })
})
