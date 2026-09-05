import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  isTurnstileEnabled,
  normalizeTurnstileMode,
  useTurnstileGate
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

describe('useTurnstileGate', () => {
  it('waits while enabled with no token yet', () => {
    const { waiting } = useTurnstileGate(ref(true))
    expect(waiting.value).toBe(true)
  })

  it('never waits while disabled', () => {
    const { waiting } = useTurnstileGate(ref(false))
    expect(waiting.value).toBe(false)
  })

  it('stops waiting once a token arrives', () => {
    const { token, waiting } = useTurnstileGate(ref(true))

    token.value = 'token-abc'

    expect(waiting.value).toBe(false)
  })

  it('stops waiting once the widget reports itself unavailable', () => {
    const { unavailable, waiting } = useTurnstileGate(ref(true))

    unavailable.value = true

    expect(waiting.value).toBe(false)
  })

  it('clears stale token/unavailable state when enabled turns off', async () => {
    const enabled = ref(true)
    const { token, unavailable } = useTurnstileGate(enabled)
    token.value = 'stale-token'
    unavailable.value = true

    enabled.value = false
    await nextTick()

    expect(token.value).toBe('')
    expect(unavailable.value).toBe(false)
  })

  // Regression coverage: the reset used to only run on the enabled->disabled
  // transition, so state written while the widget was briefly disabled could
  // survive into the next enabled widget instance.
  it('clears stale token/unavailable state when enabled turns back on', async () => {
    const enabled = ref(true)
    const { token, unavailable } = useTurnstileGate(enabled)

    enabled.value = false
    await nextTick()
    token.value = 'stale-token'
    unavailable.value = true

    enabled.value = true
    await nextTick()

    expect(token.value).toBe('')
    expect(unavailable.value).toBe(false)
  })
})
