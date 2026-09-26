import { fromPartial } from '@total-typescript/shoehorn'
import type { FeatureFlagsCallback } from 'posthog-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DISTRIBUTIONS_FLAG,
  askPlatformForDistributions,
  createDeployToComfyApiGate
} from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'
import type { AuthHeader } from '@/types/authTypes'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

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

function account() {
  let signIn: () => void = () => {}
  let signOut: () => void = () => {}
  return {
    onSignIn: (check: () => void) => {
      signIn = check
    },
    onSignOut: (hide: () => void) => {
      signOut = hide
    },
    signIn: () => signIn(),
    signOut: () => signOut()
  }
}

function gate(
  overrides: Partial<Parameters<typeof createDeployToComfyApiGate>[0]> = {}
) {
  const user = account()
  const sources = {
    loadFlags: vi.fn(() => Promise.resolve(fakePostHog({}))),
    askPlatform: vi.fn(() => Promise.resolve(false)),
    onSignIn: user.onSignIn,
    onSignOut: user.onSignOut,
    ...overrides
  }
  return { ...createDeployToComfyApiGate(sources), sources, user }
}

describe('createDeployToComfyApiGate on Cloud', () => {
  beforeEach(() => {
    distribution.isCloud = true
  })

  it('shows the entry when PostHog already has distributions on for this account', async () => {
    const { enabled } = gate({
      loadFlags: () =>
        Promise.resolve(fakePostHog({ [DISTRIBUTIONS_FLAG]: true }))
    })

    expect(enabled.value).toBe(false)
    await vi.waitFor(() => expect(enabled.value).toBe(true))
  })

  it('follows the flag when PostHog delivers it after the menu is built', async () => {
    const posthog = fakePostHog({})
    const { enabled } = gate({ loadFlags: () => Promise.resolve(posthog) })
    await Promise.resolve()

    posthog.turnOn()

    expect(enabled.value).toBe(true)
  })

  it('ignores a delivery that reports a loading error', async () => {
    const posthog = fakePostHog({})
    const { enabled } = gate({ loadFlags: () => Promise.resolve(posthog) })
    await Promise.resolve()

    posthog.turnOn({ errorsLoading: true })

    expect(enabled.value).toBe(false)
  })

  it('hides the entry when the account signs out', async () => {
    const { enabled, user } = gate({
      loadFlags: () =>
        Promise.resolve(fakePostHog({ [DISTRIBUTIONS_FLAG]: true }))
    })
    await vi.waitFor(() => expect(enabled.value).toBe(true))

    user.signOut()

    expect(enabled.value).toBe(false)
  })

  it('lets the next caller try again when the flags could not be loaded', async () => {
    const onLoadFailed = vi.fn()

    gate({ loadFlags: () => Promise.reject(new Error('chunk')), onLoadFailed })

    await vi.waitFor(() => expect(onLoadFailed).toHaveBeenCalledOnce())
  })

  it('never asks the platform', () => {
    const { sources, user } = gate()

    user.signIn()

    expect(sources.askPlatform).not.toHaveBeenCalled()
  })
})

describe('createDeployToComfyApiGate on localhost and Desktop', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('stays hidden until someone signs in, and never loads PostHog', async () => {
    const { enabled, sources } = gate({
      askPlatform: vi.fn(() => Promise.resolve(true))
    })
    await Promise.resolve()

    expect(enabled.value).toBe(false)
    expect(sources.askPlatform).not.toHaveBeenCalled()
    expect(sources.loadFlags).not.toHaveBeenCalled()
  })

  it.for([
    { answer: true, shown: true },
    { answer: false, shown: false }
  ])(
    'follows the platform for the signed-in account ($answer)',
    async ({ answer, shown }) => {
      const { enabled, user } = gate({
        askPlatform: vi.fn(() => Promise.resolve(answer))
      })

      user.signIn()

      await vi.waitFor(() => expect(enabled.value).toBe(shown))
    }
  )

  it('hides the entry when the account signs out', async () => {
    const { enabled, user } = gate({
      askPlatform: vi.fn(() => Promise.resolve(true))
    })
    user.signIn()
    await vi.waitFor(() => expect(enabled.value).toBe(true))

    user.signOut()

    expect(enabled.value).toBe(false)
  })

  it('ignores an answer that arrives after the account signed out', async () => {
    let answer!: (value: boolean) => void
    const { enabled, user } = gate({
      askPlatform: () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        })
    })

    user.signIn()
    user.signOut()
    answer(true)
    await Promise.resolve()

    expect(enabled.value).toBe(false)
  })
})

describe('askPlatformForDistributions', () => {
  const bearer = { Authorization: 'Bearer firebase-token' as const }

  function platformAnswers(response: Partial<Response>) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(fromPartial<Response>(response))
  }

  it('asks the platform with the signed-in bearer and reads its answer', async () => {
    const fetch = platformAnswers({
      ok: true,
      json: () => Promise.resolve({ enabled: true })
    })

    await expect(
      askPlatformForDistributions(() => Promise.resolve(bearer))
    ).resolves.toBe(true)

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(
      'https://platform.comfy.org/api/flags/distributions-enabled'
    )
    expect(init).toEqual({ headers: bearer })
  })

  it.for([
    {
      case: 'the platform does not serve the route yet',
      header: bearer,
      response: { ok: false, status: 404 }
    },
    {
      case: 'the answer is not the contract',
      header: bearer,
      response: { ok: true, json: () => Promise.resolve({ enabled: 'yes' }) }
    },
    {
      case: 'the user signed in with an API key',
      header: { 'X-API-KEY': 'key' },
      response: { ok: true, json: () => Promise.resolve({ enabled: true }) }
    },
    {
      case: 'nobody is signed in',
      header: null,
      response: { ok: true, json: () => Promise.resolve({ enabled: true }) }
    }
  ])('keeps the entry hidden when $case', async ({ header, response }) => {
    platformAnswers(response)

    await expect(
      askPlatformForDistributions(() =>
        Promise.resolve<AuthHeader | null>(header)
      )
    ).resolves.toBe(false)
  })

  it('keeps the entry hidden when the platform cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'))

    await expect(
      askPlatformForDistributions(() => Promise.resolve(bearer))
    ).resolves.toBe(false)
  })
})

describe('createDeployToComfyApiGate in a development build', () => {
  it('shows the entry without asking anyone', () => {
    vi.stubEnv('MODE', 'development')

    const { enabled, sources } = gate()

    expect(enabled.value).toBe(true)
    expect(sources.loadFlags).not.toHaveBeenCalled()
  })
})
