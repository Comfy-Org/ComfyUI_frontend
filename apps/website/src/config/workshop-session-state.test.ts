import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { WorkshopSession } from './workshop-session-state'

const h = vi.hoisted(() => {
  const state = {
    initialFlag: true,
    flag: undefined as Ref<boolean> | undefined,
    listeners: new Set<(snapshot: unknown) => void>(),
    snapshot: {
      phase: 'signed-out',
      user: null,
      session: undefined
    } as unknown,
    firebaseEvaluated: vi.fn(),
    identifyWorkshopUser: vi.fn(),
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

vi.mock<unknown>(import('../scripts/posthog'), () => {
  return {
    identifyWorkshopUser: h.identifyWorkshopUser,
    useWorkshopAuthFlag: () => h.flag
  }
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
  h.flag = ref(h.initialFlag)
  const mod = await import('./workshop-session-state')
  const session = mod.useWorkshopSession()
  if (h.initialFlag) {
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledOnce())
  }
  return session
}

beforeEach(() => {
  window.localStorage.removeItem('workshop:workspace')
  h.remint.mockReset()
  h.initialFlag = true
  h.listeners.clear()
  h.snapshot = { phase: 'signed-out', user: null, session: undefined }
  h.firebaseEvaluated.mockClear()
  h.attachIdentity.mockClear()
  h.ensureFresh.mockReset()
  h.clearStoredCredential.mockClear()
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

    expect(h.identifyWorkshopUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )
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

    expect(h.ensureFresh).toHaveBeenCalledWith(
      popupUser,
      expect.objectContaining({ workspaceId: undefined })
    )
  })

  it('restores the remembered workspace after a reload lands on personal', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    h.remint.mockResolvedValue({ status: 'ok' })
    await importFresh()

    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: okSession,
      settled: true
    })

    await vi.waitFor(() =>
      expect(h.remint).toHaveBeenCalledWith(undefined, {
        workspaceId: 'team-9',
        preserveCredentialOnTransientFailure: true
      })
    )
  })

  it('holds the boot snapshot back while the restore is in flight', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    let releaseRemint!: (value: unknown) => void
    h.remint.mockImplementation(
      () => new Promise((resolve) => (releaseRemint = resolve))
    )
    const s = await importFresh()

    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: okSession,
      settled: true
    })

    await vi.waitFor(() => expect(h.remint).toHaveBeenCalledOnce())
    expect(s.session.value, 'the personal boot must not flash').toBeUndefined()
    expect(h.identifyWorkshopUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )

    const restored = {
      ...okSession,
      workspace: { id: 'team-9', name: 'Studio', type: 'team' as const }
    }
    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: restored,
      settled: true
    })
    releaseRemint({ status: 'ok', session: restored })

    await vi.waitFor(() => expect(s.session.value?.workspace.id).toBe('team-9'))
  })

  it('publishes only the client-owned fallback after a remembered workspace is refused', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    h.remint
      .mockImplementationOnce(async () => {
        h.publish({
          phase: 'error',
          user: { uid: 'user-1' },
          session: undefined,
          failure: { status: 'error', code: 'ACCESS_DENIED' }
        })
        return { status: 'error', code: 'ACCESS_DENIED' }
      })
      .mockImplementationOnce(async () => {
        h.publish(authenticatedSnapshot())
        return { status: 'ok', session: okSession }
      })
    const s = await importFresh()

    h.publish(authenticatedSnapshot())

    await vi.waitFor(() => expect(h.remint).toHaveBeenCalledTimes(2))
    expect(h.remint).toHaveBeenNthCalledWith(2, undefined, {
      workspaceId: 'ws',
      preserveCredentialOnTransientFailure: true
    })
    expect(s.session.value).toEqual(okSession)
    expect(h.snapshot).toEqual(authenticatedSnapshot())
  })

  it('keeps a client-owned boot session after a transient restore failure', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    h.remint.mockResolvedValue({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
    const s = await importFresh()

    h.publish(authenticatedSnapshot())

    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    expect(window.localStorage.getItem('workshop:workspace')).toBe(
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
  })

  it('remembers the workspace each authenticated snapshot names', async () => {
    window.localStorage.removeItem('workshop:workspace')
    await importFresh()

    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: {
        ...okSession,
        workspace: { id: 'team-3', name: 'Studio', type: 'team' }
      },
      settled: true
    })

    await vi.waitFor(() =>
      expect(window.localStorage.getItem('workshop:workspace')).toBe(
        JSON.stringify({ uid: 'user-1', workspaceId: 'team-3' })
      )
    )
    expect(h.remint).not.toHaveBeenCalled()
  })

  it('keeps the first workspace the user intentionally switches to', async () => {
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    h.remint.mockResolvedValue({ status: 'ok' })

    const team = {
      ...okSession,
      workspace: { id: 'team-3', name: 'Studio', type: 'team' as const }
    }
    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: team
    })

    await vi.waitFor(() => expect(s.session.value).toEqual(team))
    expect(
      h.remint,
      'an intentional switch must not be mistaken for a boot-time restore'
    ).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('workshop:workspace')).toBe(
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-3' })
    )
  })

  it('does not resurrect the held boot session after sign-out wins a restore race', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    let finishRestore!: (value: undefined) => void
    h.remint.mockImplementation(
      () => new Promise((resolve) => (finishRestore = resolve))
    )
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(h.remint).toHaveBeenCalledOnce())

    h.publish({ phase: 'signed-out', user: null, session: undefined })
    finishRestore(undefined)

    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(s.signedIn.value).toBe(false)
  })

  it('refreshes an errored session for its remembered workspace', async () => {
    const s = await importFresh()
    const team = {
      ...okSession,
      workspace: { id: 'team-3', name: 'Studio', type: 'team' as const }
    }
    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: team
    })
    await vi.waitFor(() => expect(s.session.value).toEqual(team))
    h.publish({
      phase: 'error',
      user: { uid: 'user-1' },
      session: undefined,
      failure: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    })

    await s.ensureFresh()

    expect(h.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'team-3' })
    )
  })

  it('clears the session on sign-out', async () => {
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    h.publish({ phase: 'signed-out', user: null, session: undefined })

    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(s.signedIn.value).toBe(false)
    expect(h.identifyWorkshopUser).toHaveBeenLastCalledWith(null)
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

  it('allows remembered-workspace restoration after the flag settles off and turns on again', async () => {
    const s = await importFresh()
    h.publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    h.flag!.value = false
    await vi.waitFor(() => expect(h.clearStoredCredential).toHaveBeenCalled())
    // The real identity detach resets the client snapshot; this test double does not.
    h.snapshot = { phase: 'pending', user: null, session: undefined }

    h.remint.mockResolvedValue({ status: 'ok', session: okSession })
    h.flag!.value = true
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledTimes(2))
    h.publish({
      phase: 'authenticated',
      user: { uid: 'user-1' },
      session: {
        ...okSession,
        workspace: { id: 'personal', name: 'Default', type: 'personal' }
      }
    })

    await vi.waitFor(() =>
      expect(
        h.remint,
        'settling off ends one auth lifecycle; the next lifecycle must be allowed to restore the remembered workspace for the same uid'
      ).toHaveBeenCalledWith(undefined, {
        workspaceId: 'ws',
        preserveCredentialOnTransientFailure: true
      })
    )
  })
})
