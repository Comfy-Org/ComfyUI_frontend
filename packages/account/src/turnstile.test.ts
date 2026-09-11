import { describe, expect, it } from 'vitest'

import {
  TURNSTILE_MESSAGES,
  isTurnstileEnabled,
  normalizeTurnstileMode
} from './turnstile'

describe('normalizeTurnstileMode', () => {
  it('passes through known modes', () => {
    expect(normalizeTurnstileMode('off')).toBe('off')
    expect(normalizeTurnstileMode('shadow')).toBe('shadow')
    expect(normalizeTurnstileMode('enforce')).toBe('enforce')
  })

  it('clamps unknown or missing values to off', () => {
    expect(normalizeTurnstileMode('enfroce')).toBe('off')
    expect(normalizeTurnstileMode('')).toBe('off')
    expect(normalizeTurnstileMode(undefined)).toBe('off')
  })
})

describe('isTurnstileEnabled', () => {
  it('renders when the flag is active and a sitekey is configured', () => {
    expect(isTurnstileEnabled('shadow', 'site-key')).toBe(true)
    expect(isTurnstileEnabled('enforce', 'site-key')).toBe(true)
  })

  it('does not render when the flag is off', () => {
    expect(isTurnstileEnabled('off', 'site-key')).toBe(false)
  })

  it('does not render without a sitekey (OSS / local builds)', () => {
    expect(isTurnstileEnabled('shadow', '')).toBe(false)
    expect(isTurnstileEnabled('enforce', '')).toBe(false)
  })
})

describe('TURNSTILE_MESSAGES', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    '%s carries expired, failed and the submit hint',
    (locale) => {
      const copy = TURNSTILE_MESSAGES[locale]
      expect(copy.expired).toBeTruthy()
      expect(copy.failed).toBeTruthy()
      expect(copy.submitBlockedHint).toBeTruthy()
      expect(
        new Set([copy.expired, copy.failed, copy.submitBlockedHint]).size,
        'three distinct situations must not share a line'
      ).toBe(3)
    }
  )
})
