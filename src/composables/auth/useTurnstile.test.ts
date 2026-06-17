import { describe, expect, it } from 'vitest'

import { isTurnstileEnabled } from '@/composables/auth/useTurnstile'

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
