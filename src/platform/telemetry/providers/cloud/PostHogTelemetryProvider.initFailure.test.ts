import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueModule from 'vue'

const hoisted = vi.hoisted(() => ({
  init: vi.fn(),
  onUserResolved: vi.fn(),
  onUserLogout: vi.fn()
}))

vi.mock('posthog-js', () => ({
  default: {
    init: hoisted.init,
    capture: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    people: { set: vi.fn(), set_once: vi.fn() },
    reset: vi.fn()
  }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserResolved: hoisted.onUserResolved,
    onUserLogout: hoisted.onUserLogout
  })
}))

vi.mock('@/platform/remoteConfig/remoteConfig', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { remoteConfig: ref(null) }
})

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await vi.importActual<typeof VueModule>('vue')
  return { useBillingContext: () => ({ tier: ref(null) }) }
})

import { PostHogTelemetryProvider } from './PostHogTelemetryProvider'

function messagesFor(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((args) => String(args[0]))
    .filter((message) => message.includes('PostHog'))
}

describe('PostHogTelemetryProvider initialisation failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.__CONFIG__ = {
      posthog_project_token: 'phc_test_token'
    } as typeof window.__CONFIG__
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('surfaces an error when our own initialisation throws', async () => {
    hoisted.init.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading '_s')")
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    new PostHogTelemetryProvider()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(messagesFor(error)).toEqual(['Failed to initialize PostHog:'])
    expect(messagesFor(warn)).toEqual([])
  })
})
