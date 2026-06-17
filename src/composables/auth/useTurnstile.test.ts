import { describe, expect, it } from 'vitest'

import { isTurnstileOrigin } from '@/composables/auth/useTurnstile'

describe('isTurnstileOrigin', () => {
  it('renders on the cloud origin for a real host', () => {
    expect(isTurnstileOrigin(true, 'app.comfy.org')).toBe(true)
  })

  it('does not render on OSS / non-cloud builds', () => {
    expect(isTurnstileOrigin(false, 'app.comfy.org')).toBe(false)
    expect(isTurnstileOrigin(false, '127.0.0.1')).toBe(false)
  })

  it('does not render on local cloud-dev hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
      expect(isTurnstileOrigin(true, host)).toBe(false)
    }
  })
})
