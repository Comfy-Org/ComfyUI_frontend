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
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await posthog.subscribed

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
    posthog.identify('alice', true)

    expect(state.value).toMatchObject({ status: 'answered', enabled: true })
  })

  it('does not trust flags PostHog still holds for another account', async () => {
    const posthog = fakePostHog('alice', true)
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('bob')
    await posthog.subscribed

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('hides the entry the moment another account signs in, until PostHog answers for it', async () => {
    const posthog = fakePostHog('alice', true)
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() =>
      expect(state.value).toMatchObject({ status: 'answered', enabled: true })
    )

    user.signIn('bob')
    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })

    posthog.identify('bob', false)
    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('stays hidden when PostHog loads only after the account signed out', async () => {
    const load = deferred<FlagReader>()
    const { state, user } = gate({ loadFlags: () => load.promise })
    user.signIn('alice')
    user.signOut()

    const posthog = fakePostHog('alice', true)
    load.resolve(posthog.reader)
    await posthog.subscribed

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('hides the entry when the account signs out', async () => {
    const posthog = fakePostHog('alice', true)
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() =>
      expect(state.value).toMatchObject({ status: 'answered', enabled: true })
    )

    user.signOut()

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('hides the entry when a flag refresh fails', async () => {
    const posthog = fakePostHog('alice', true)
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await vi.waitFor(() =>
      expect(state.value).toMatchObject({ status: 'answered', enabled: true })
    )

    posthog.failDelivery()

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('treats the same account resolving again as no change', async () => {
    const posthog = fakePostHog('alice', true)
    const { state, user } = gate({
      loadFlags: () => Promise.resolve(posthog.reader)
    })
    user.signIn('alice')
    await posthog.subscribed
    const before = state.value

    user.signIn('alice')

    expect(state.value).toBe(before)
    expect(state.value).toMatchObject({ status: 'answered', enabled: true })
    expect(state.value).toMatchObject({ generation: 1 })
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
    const { state, sources, user } = gate({
      askPlatform: vi.fn(() => Promise.resolve(true))
    })

    user.signIn('alice')

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
    expect(state.value).toEqual({ status: 'awaiting' })
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
      const { state, sources, user, check } = gate({
        askPlatform: vi.fn(() => reply.promise)
      })
      user.signIn('alice')

      check()
      check()
      reply.resolve(answer)
      await reply.promise

      expect(sources.askPlatform).toHaveBeenCalledOnce()
      expect(state.value).toMatchObject({ status: 'answered', enabled: shown })
    }
  )

  it('treats the same account resolving again as no change, and does not ask twice', async () => {
    const reply = deferred<boolean>()
    const { state, sources, user, check } = gate({
      askPlatform: vi.fn(() => reply.promise)
    })
    user.signIn('alice')
    check()
    reply.resolve(true)
    await reply.promise

    user.signIn('alice')
    check()

    expect(sources.askPlatform).toHaveBeenCalledOnce()
    expect(state.value).toMatchObject({ status: 'answered', enabled: true })
    expect(state.value).toMatchObject({ generation: 1 })
  })

  it('asks again for the next account, and hides the entry until it answers', async () => {
    const aliceAnswer = deferred<boolean>()
    const bobAnswer = deferred<boolean>()
    const askPlatform = vi
      .fn<() => Promise<boolean>>()
      .mockReturnValueOnce(aliceAnswer.promise)
      .mockReturnValueOnce(bobAnswer.promise)
    const { state, user, check } = gate({ askPlatform })
    user.signIn('alice')
    check()
    aliceAnswer.resolve(true)
    await aliceAnswer.promise
    expect(state.value).toMatchObject({ status: 'answered', enabled: true })

    user.signIn('bob')
    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
    check()
    bobAnswer.resolve(true)
    await bobAnswer.promise

    expect(askPlatform).toHaveBeenCalledTimes(2)
    expect(state.value).toMatchObject({ status: 'answered', enabled: true })
  })

  it('ignores an answer that arrives after the account signed out', async () => {
    const answer = deferred<boolean>()
    const { state, user, check } = gate({ askPlatform: () => answer.promise })

    user.signIn('alice')
    check()
    user.signOut()
    answer.resolve(true)
    await answer.promise

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })

  it('ignores an earlier account’s answer that arrives after the next one signed in', async () => {
    const aliceAnswer = deferred<boolean>()
    const askPlatform = vi
      .fn<() => Promise<boolean>>()
      .mockReturnValueOnce(aliceAnswer.promise)
      .mockResolvedValueOnce(false)
    const { state, user, check } = gate({ askPlatform })

    user.signIn('alice')
    check()
    user.signIn('bob')
    aliceAnswer.resolve(true)
    await aliceAnswer.promise

    expect(state.value).not.toMatchObject({ status: 'answered', enabled: true })
  })
})

describe('createDeployToComfyApiGate in a development build', () => {
  it('shows the entry without asking anyone', () => {
    vi.stubEnv('MODE', 'development')

    const { state, sources } = gate()

    expect(state.value).toMatchObject({ status: 'answered', enabled: true })
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
    expect(mountedMenu.state.value).toEqual({ status: 'awaiting' })

    mountedMenu.check()

    expect(useDeployToComfyApiGate().state).toBe(mountedMenu.state)
    await vi.waitFor(() =>
      expect(mountedMenu.state.value).toEqual({
        status: 'answered',
        generation: 1,
        enabled: true
      })
    )
  })
})
