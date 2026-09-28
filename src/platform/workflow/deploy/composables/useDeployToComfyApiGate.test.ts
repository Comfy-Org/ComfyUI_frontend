import { fromPartial } from '@total-typescript/shoehorn'
import type { FeatureFlagsCallback } from 'posthog-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { loadPostHogFlags } from '@/platform/workflow/deploy/composables/postHogFlags'
import type { FlagReader } from '@/platform/workflow/deploy/composables/postHogFlags'
import { reportError } from '@/platform/telemetry/reportError'
import { createDeployToComfyApiGate } from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock(import('@/platform/workflow/deploy/composables/postHogFlags'), () => ({
  loadPostHogFlags: vi.fn<() => Promise<FlagReader>>()
}))

vi.mock(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: vi.fn()
}))

function deferred<T>() {
  const handle: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    handle.resolve = resolve
  })
  const { resolve } = handle
  if (!resolve) throw new Error('The promise executor did not run')
  return { promise, resolve }
}

/** The platform's flag, as PostHog names it. Pinned here, not imported. */
const FLAG = 'distributions_enabled'

/**
 * PostHog as the gate sees it: who it is identified as, and its flags.
 * `subscribed` settles when the gate registers for flag deliveries, which it
 * does right before its first read.
 */
function fakePostHog(identity: string, flagged: boolean) {
  const state = { identity, flagged }
  let deliver: FeatureFlagsCallback = () => {}
  const subscription = deferred<void>()
  const reader: FlagReader = {
    get_distinct_id: () => state.identity,
    isFeatureEnabled: (flag) => (flag === FLAG ? state.flagged : undefined),
    onFeatureFlags: (callback) => {
      deliver = callback
      subscription.resolve()
    }
  }
  return {
    reader,
    subscribed: subscription.promise,
    identify(id: string, flaggedFor: boolean) {
      state.identity = id
      state.flagged = flaggedFor
      deliver([FLAG], {}, {})
    },
    failDelivery() {
      deliver([], {}, { errorsLoading: true })
    }
  }
}

function account() {
  let signIn: (userId: string) => void = () => {}
  let signOut: () => void = () => {}
  return {
    onSignIn: (check: (userId: string) => void) => {
      signIn = check
    },
    onSignOut: (hide: () => void) => {
      signOut = hide
    },
    signIn: (userId: string) => signIn(userId),
    signOut: () => signOut()
  }
}

function gate(
  overrides: Partial<Parameters<typeof createDeployToComfyApiGate>[0]> = {}
) {
  const user = account()
  const sources = {
    loadFlags: vi.fn(() => Promise.resolve(fakePostHog('', false).reader)),
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

  it('shows the entry once PostHog is identified as the signed-in, flagged account', async () => {
    const posthog = fakePostHog('anonymous', false)
    const { enabled, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await posthog.subscribed

    expect(enabled.value).toBe(false)
    posthog.identify('alice', true)

    expect(enabled.value).toBe(true)
  })

  it('does not trust flags PostHog still holds for another account', async () => {
    const posthog = fakePostHog('alice', true)
    const { enabled, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('bob')
    await posthog.subscribed

    expect(enabled.value).toBe(false)
  })

  it('hides the entry the moment another account signs in, until PostHog answers for it', async () => {
    const posthog = fakePostHog('alice', true)
    const { enabled, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() => expect(enabled.value).toBe(true))

    user.signIn('bob')
    expect(enabled.value).toBe(false)

    posthog.identify('bob', false)
    expect(enabled.value).toBe(false)
  })

  it('stays hidden when PostHog loads only after the account signed out', async () => {
    const load = deferred<FlagReader>()
    const { enabled, user } = gate({ loadFlags: () => load.promise })
    user.signIn('alice')
    user.signOut()

    const posthog = fakePostHog('alice', true)
    load.resolve(posthog.reader)
    await posthog.subscribed

    expect(enabled.value).toBe(false)
  })

  it('hides the entry when the account signs out', async () => {
    const posthog = fakePostHog('alice', true)
    const { enabled, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() => expect(enabled.value).toBe(true))

    user.signOut()

    expect(enabled.value).toBe(false)
  })

  it('hides the entry when a flag refresh fails', async () => {
    const posthog = fakePostHog('alice', true)
    const { enabled, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() => expect(enabled.value).toBe(true))

    posthog.failDelivery()

    expect(enabled.value).toBe(false)
  })

  it('never asks the platform', () => {
    const { sources, user } = gate()

    user.signIn('alice')

    expect(sources.askPlatform).not.toHaveBeenCalled()
  })
})

describe('createDeployToComfyApiGate on localhost and Desktop', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('makes no request on sign-in, and never loads PostHog', () => {
    const { enabled, answeredFor, sources, user } = gate({
      askPlatform: vi.fn(() => Promise.resolve(true))
    })

    user.signIn('alice')

    expect(enabled.value).toBe(false)
    expect(answeredFor.value).toBeUndefined()
    expect(sources.askPlatform).not.toHaveBeenCalled()
    expect(sources.loadFlags).not.toHaveBeenCalled()
  })

  it('asks nobody when checked while signed out', () => {
    const { sources, check } = gate()

    check()

    expect(sources.askPlatform).not.toHaveBeenCalled()
  })

  it.for([
    { answer: true, shown: true },
    { answer: false, shown: false }
  ])(
    'asks the platform the first time a menu checks, and follows its answer ($answer)',
    async ({ answer, shown }) => {
      const reply = deferred<boolean>()
      const { enabled, answeredFor, sources, user, check } = gate({
        askPlatform: vi.fn(() => reply.promise)
      })
      user.signIn('alice')

      check()
      check()
      reply.resolve(answer)
      await reply.promise

      expect(sources.askPlatform).toHaveBeenCalledOnce()
      expect(enabled.value).toBe(shown)
      expect(answeredFor.value).toBeTypeOf('number')
    }
  )

  it('asks again for the next account, and hides the entry until it answers', async () => {
    const aliceAnswer = deferred<boolean>()
    const bobAnswer = deferred<boolean>()
    const askPlatform = vi
      .fn<() => Promise<boolean>>()
      .mockReturnValueOnce(aliceAnswer.promise)
      .mockReturnValueOnce(bobAnswer.promise)
    const { enabled, user, check } = gate({ askPlatform })
    user.signIn('alice')
    check()
    aliceAnswer.resolve(true)
    await aliceAnswer.promise
    expect(enabled.value).toBe(true)

    user.signIn('bob')
    expect(enabled.value).toBe(false)
    check()
    bobAnswer.resolve(true)
    await bobAnswer.promise

    expect(askPlatform).toHaveBeenCalledTimes(2)
    expect(enabled.value).toBe(true)
  })

  it('ignores an answer that arrives after the account signed out', async () => {
    const answer = deferred<boolean>()
    const { enabled, user, check } = gate({ askPlatform: () => answer.promise })

    user.signIn('alice')
    check()
    user.signOut()
    answer.resolve(true)
    await answer.promise

    expect(enabled.value).toBe(false)
  })

  it('ignores an earlier account’s answer that arrives after the next one signed in', async () => {
    const aliceAnswer = deferred<boolean>()
    const askPlatform = vi
      .fn<() => Promise<boolean>>()
      .mockReturnValueOnce(aliceAnswer.promise)
      .mockResolvedValueOnce(false)
    const { enabled, user, check } = gate({ askPlatform })

    user.signIn('alice')
    check()
    user.signIn('bob')
    aliceAnswer.resolve(true)
    await aliceAnswer.promise

    expect(enabled.value).toBe(false)
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

describe('useDeployToComfyApiGate', () => {
  it('recovers the ref a mounted menu already holds when a menu open retries a failed PostHog load', async () => {
    vi.resetModules()
    distribution.isCloud = true
    const posthog = fakePostHog('alice', true)
    vi.mocked(loadPostHogFlags)
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(posthog.reader)
    vi.mocked(useCurrentUser).mockReturnValue(
      fromPartial({
        onUserResolved: (callback: (user: { id: string }) => void) =>
          callback({ id: 'alice' }),
        onUserLogout: () => {}
      })
    )
    const { useDeployToComfyApiGate } =
      await import('@/platform/workflow/deploy/composables/useDeployToComfyApiGate')

    const mountedMenu = useDeployToComfyApiGate()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    expect(mountedMenu.enabled.value).toBe(false)

    mountedMenu.check()

    expect(useDeployToComfyApiGate().enabled).toBe(mountedMenu.enabled)
    await vi.waitFor(() => expect(mountedMenu.enabled.value).toBe(true))
  })
})
