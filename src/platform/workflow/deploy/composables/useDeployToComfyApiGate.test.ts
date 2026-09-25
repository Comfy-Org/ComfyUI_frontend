import type { FeatureFlagsCallback } from 'posthog-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DISTRIBUTIONS_FLAG,
  createDeployToComfyApiGate
} from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

function fakePostHog(flags: Record<string, boolean | undefined>) {
  let deliver: FeatureFlagsCallback | undefined
  return {
    isFeatureEnabled: (flag: string) => flags[flag],
    onFeatureFlags: (callback: FeatureFlagsCallback) => {
      deliver = callback
    },
    turnOn(context?: { errorsLoading?: boolean }) {
      flags[DISTRIBUTIONS_FLAG] = true
      deliver?.([DISTRIBUTIONS_FLAG], {}, context)
    }
  }
}

describe('createDeployToComfyApiGate', () => {
  beforeEach(() => {
    distribution.isCloud = true
  })

  it('shows the entry when the platform already has distributions on for this account', async () => {
    const posthog = fakePostHog({ [DISTRIBUTIONS_FLAG]: true })

    const { enabled } = createDeployToComfyApiGate(() =>
      Promise.resolve(posthog)
    )

    expect(enabled.value).toBe(false)
    await vi.waitFor(() => expect(enabled.value).toBe(true))
  })

  it('follows the flag when PostHog delivers it after the menu is built', async () => {
    const posthog = fakePostHog({})
    const { enabled } = createDeployToComfyApiGate(() =>
      Promise.resolve(posthog)
    )
    await Promise.resolve()

    posthog.turnOn()

    expect(enabled.value).toBe(true)
  })

  it('ignores a delivery that reports a loading error', async () => {
    const posthog = fakePostHog({})
    const { enabled } = createDeployToComfyApiGate(() =>
      Promise.resolve(posthog)
    )
    await Promise.resolve()

    posthog.turnOn({ errorsLoading: true })

    expect(enabled.value).toBe(false)
  })

  it('hides the entry when the account signs out', async () => {
    const posthog = fakePostHog({ [DISTRIBUTIONS_FLAG]: true })
    let signOut!: () => void

    const { enabled } = createDeployToComfyApiGate(
      () => Promise.resolve(posthog),
      {
        onSignOut: (hide) => {
          signOut = hide
        }
      }
    )
    await vi.waitFor(() => expect(enabled.value).toBe(true))
    signOut()

    expect(enabled.value).toBe(false)
  })

  it('lets the next caller try again when the flags could not be loaded', async () => {
    const onLoadFailed = vi.fn()

    createDeployToComfyApiGate(() => Promise.reject(new Error('chunk')), {
      onLoadFailed
    })

    await vi.waitFor(() => expect(onLoadFailed).toHaveBeenCalledOnce())
  })

  it('stays hidden off Cloud and never asks PostHog', async () => {
    distribution.isCloud = false
    const loadFlags = vi.fn(() =>
      Promise.resolve(fakePostHog({ [DISTRIBUTIONS_FLAG]: true }))
    )

    const { enabled } = createDeployToComfyApiGate(loadFlags)
    await Promise.resolve()

    expect(enabled.value).toBe(false)
    expect(loadFlags).not.toHaveBeenCalled()
  })

  it('shows the entry in a development build without asking PostHog', () => {
    vi.stubEnv('MODE', 'development')
    const loadFlags = vi.fn(() => Promise.resolve(fakePostHog({})))

    const { enabled } = createDeployToComfyApiGate(loadFlags)

    expect(enabled.value).toBe(true)
    expect(loadFlags).not.toHaveBeenCalled()
  })
})
