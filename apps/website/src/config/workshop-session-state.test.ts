// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession } from './workshop-session-state'

const h = vi.hoisted(() => {
  const state = {
    initialFlag: true,
    flag: undefined as { value: boolean } | undefined,
    listeners: new Set<(snapshot: unknown) => void>(),
    snapshot: {
      phase: 'signed-out',
      user: null,
      session: undefined
    } as unknown,
    firebaseEvaluated: vi.fn(),
    attachIdentity: vi.fn(() => () => undefined),
    ensureFresh: vi.fn(),
    remint: vi.fn(),
    clearStoredCredential: vi.fn(),
    publish(next: unknown) {
      state.snapshot = next
      state.listeners.forEach((listener) => listener(next))
    }
  }
  return state
})

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(h.initialFlag)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock<unknown>(import('./workshop-firebase'), async () => {
  const { createTestIdentity } = await import('@comfyorg/account/testing')
  h.firebaseEvaluated()
  return {
    workshopIdentity: createTestIdentity({
      onUserChanged: () => () => undefined
    }),
    signOutWorkshop: vi.fn()
  }
})

vi.mock<unknown>(import('./workshop-account'), () => ({
  workshopSessionClient: {
    subscribe: (listener: (snapshot: unknown) => void) => {
      h.listeners.add(listener)
      listener(h.snapshot)
      return () => h.listeners.delete(listener)
    },
    attachIdentity: h.attachIdentity,
    ensureFresh: h.ensureFresh,
    remint: h.remint,
    clearStoredCredential: h.clearStoredCredential,
    getSnapshot: () => h.snapshot,
    getToken: vi.fn()
  },
  subscribeAuthRefreshTelemetry: () => () => undefined
}))

const okSession: WorkshopSession = {
  token: 'jwt',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'user-1',
  workspace: { id: 'ws', name: 'Personal', type: 'personal' },
  role: 'owner'
}

function authenticatedSnapshot() {
  return {
    phase: 'authenticated',
    user: { uid: 'user-1' },
    session: okSession
  }
}

async function importFresh() {
  vi.resetModules()
  const mod = await import('./workshop-session-state')
  const session = mod.useWorkshopSession()
  if (h.initialFlag) {
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledOnce())
  }
  return session
}

beforeEach(() => {
  h.initialFlag = true
  h.listeners.clear()
  h.snapshot = { phase: 'signed-out', user: null, session: undefined }
})

describe('useWorkshopSession', () => {
  it('does not import Firebase until the auth flag turns on', async () => {
    h.initialFlag = false
    await importFresh()

    expect(h.firebaseEvaluated).not.toHaveBeenCalled()
    h.flag!.value = true
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledOnce())
    expect(h.firebaseEvaluated).toHaveBeenCalledOnce()
  })

  it('publishes the session when a restored user mints successfully', async () => {
    const s = await importFresh()

    h.publish(authenticatedSnapshot())

    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    expect(s.signedIn.value).toBe(true)
  })

  it('drops the stale session when a refresh fails, so no stale token is served', async () => {
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    h.publish({
      phase: 'error',
      user: { uid: 'user-1' },
      session: undefined,
      failure: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    })

    await vi.waitFor(() =>
      expect(
        s.session.value,
        'a failed refresh must clear the session, or the run path fires with a stale token'
      ).toBeUndefined()
    )
  })

  it('mints directly from a popup user before the listener publishes it', async () => {
    const s = await importFresh()
    const popupUser = { uid: 'user-1', getIdToken: async () => 'id-token' }

    await s.ensureFresh(popupUser)

    expect(h.ensureFresh).toHaveBeenCalledWith(popupUser)
  })

  it('clears the session on sign-out', async () => {
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    h.publish({ phase: 'signed-out', user: null, session: undefined })

    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(s.signedIn.value).toBe(false)
  })

  it('keeps the cached credential on a cold load while the flag is still unanswered', async () => {
    h.initialFlag = false
    h.clearStoredCredential.mockClear()

    await importFresh()

    expect(
      h.clearStoredCredential,
      'the flag starts false until PostHog answers; wiping the cache here re-mints on every reload'
    ).not.toHaveBeenCalled()
  })

  it('clears the cache when the flag turns off', async () => {
    await importFresh()
    const callsBefore = h.clearStoredCredential.mock.calls.length

    h.flag!.value = false

    await vi.waitFor(() =>
      expect(
        h.clearStoredCredential.mock.calls.length,
        'flag-off must drop the cached credential'
      ).toBeGreaterThan(callsBefore)
    )
  })
})
