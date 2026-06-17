import { describe, expect, it } from 'vitest'

import {
  isTurnstileEnabled,
  normalizeTurnstileMode
} from '@/composables/auth/useTurnstile'

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
