import { describe, expect, it, vi } from 'vitest'

import {
  isThirdPartyErrorNoise,
  redactSensitiveText,
  stripUrlQuery
} from './telemetry'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'
const MESSAGING_ERROR =
  '[messaging] In this JS context, only one listener can be setup for queryMediaBinding'

describe('isThirdPartyErrorNoise', () => {
  it.for([
    EXTENSION_ERROR,
    `Error: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: Error: ${EXTENSION_ERROR}`,
    `${EXTENSION_ERROR} extension context`,
    MESSAGING_ERROR,
    `Error: ${MESSAGING_ERROR}`,
    `Unhandled promise rejection: ${MESSAGING_ERROR}`,
    `Unhandled promise rejection: Error: ${MESSAGING_ERROR}`
  ])('identifies the extension tab error in %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(true)
  })

  it.for([
    'Invalid call to runtime.sendMessage(). Receiving end does not exist.',
    `Application failed: ${EXTENSION_ERROR}`,
    `Application failed: ${MESSAGING_ERROR}`,
    'Only one listener can be setup for the websocket channel',
    '[messaging] Receiving end does not exist'
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
    },
    {
      text: 'POST https://cloud.comfy.org/api/billing/subscribe?promo=SPRING failed',
      expected: 'POST https://cloud.comfy.org/api/billing/subscribe failed'
    },
    {
      text: 'redirected to https://billing.comfy.org/v1/checkout#summary again',
      expected: 'redirected to https://billing.comfy.org/v1/checkout again'
    },
    {
      text: 'GET https://cloud.comfy.org/api/billing/status failed',
      expected: 'GET https://cloud.comfy.org/api/billing/status failed'
    },
    {
      text: 'https://a.example/x?q=1 then https://b.example/y#f and http://c.example/z',
      expected:
        'https://a.example/x then https://b.example/y and http://c.example/z'
    },
    {
      text: 'https://a.example/r?next=https://b.example/p?x=1 end',
      expected: 'https://a.example/r end'
    },
    {
      text: 'https://a.example/x?q=1 what? see #3',
      expected: 'https://a.example/x what? see #3'
    },
    {
      text: 'failed "https://a.example/x?client_secret=abc" twice',
      expected: 'failed "https://a.example/x" twice'
    },
    {
      text: 'retry (https://a.example/x?promo=1) now',
      expected: 'retry (https://a.example/x) now'
    }
  ])('rewrites "$text"', ({ text, expected }) => {
    expect(redactSensitiveText(text)).toBe(expected)
  })

  it('leaves a long run of query-free URLs untouched without rescanning it from every scheme', () => {
    const text = 'https://'.repeat(60_000)

    expect(redactSensitiveText(text)).toBe(text)
  })

  it('scans a long run of characters an email could start with in linear time', () => {
    vi.useRealTimers()
    const text = 'a.'.repeat(25_000)

    const started = performance.now()
    redactSensitiveText(text)

    expect(performance.now() - started).toBeLessThan(250)
  })
})
