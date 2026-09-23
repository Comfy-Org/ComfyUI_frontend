import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick, readonly, ref } from 'vue'

let { identifyWorkshopUser, useWorkshopAuthFlag } =
  await import('../scripts/posthog')
import { testFirebaseUser } from './__fixtures__/workshopSessionFakes'
let { workshopIdentity, workshopSessionClient } =
  await import('./workshop-account')
import type { WorkshopSession } from './workshop-session-state'

type Snapshot = ReturnType<typeof workshopSessionClient.getSnapshot>
const listeners = new Set<(snapshot: Snapshot) => void>()
let snapshot: Snapshot
let flag = ref(true)
let initialFlag = true

function publish(next: Snapshot) {
  snapshot = next
  listeners.forEach((listener) => listener(next))
}

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-account'))

const okSession: WorkshopSession = {
  token: 'jwt',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'user-1',
  workspace: { id: 'ws', name: 'Personal', type: 'personal' },
  role: 'owner'
}

const user = testFirebaseUser({ uid: 'user-1' })

function authenticatedSnapshot(): Snapshot {
  return {
    phase: 'authenticated',
    user,
    session: okSession
  }
}

async function bootSession() {
  flag = ref(initialFlag)
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
  onTestFinished(async () => {
    flag.value = false
    await nextTick()
  })
  const mod = await import('./workshop-session-state')
  const session = mod.useWorkshopSession()
  if (initialFlag) {
    await vi.waitFor(() =>
      expect(workshopIdentity.activate).toHaveBeenCalledOnce()
    )
  }
  return session
}

beforeEach(async () => {
  vi.resetModules()
  ;({ identifyWorkshopUser, useWorkshopAuthFlag } =
    await import('../scripts/posthog'))
  ;({ workshopIdentity, workshopSessionClient } =
    await import('./workshop-account'))

  window.localStorage.removeItem('workshop:workspace')
  initialFlag = true
  listeners.clear()
  snapshot = { phase: 'signed-out', user: null, session: undefined }
  vi.mocked(workshopSessionClient.getSnapshot).mockImplementation(
    () => snapshot
  )
  vi.mocked(workshopSessionClient.subscribe).mockImplementation((listener) => {
    listeners.add(listener)
    listener(snapshot)
    return () => {
      listeners.delete(listener)
    }
  })
})

describe('useWorkshopSession', () => {
  it('does not activate the identity until the auth flag turns on', async () => {
    initialFlag = false
    await bootSession()

    expect(vi.mocked(workshopIdentity.activate)).not.toHaveBeenCalled()
    flag.value = true
    await vi.waitFor(() =>
      expect(vi.mocked(workshopIdentity.activate)).toHaveBeenCalledOnce()
    )
  })

  it('publishes the session when a restored user mints successfully', async () => {
    const s = await bootSession()

    publish(authenticatedSnapshot())

    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    expect(identifyWorkshopUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )
    expect(s.signedIn.value).toBe(true)
  })

  it('drops the stale session when a refresh fails, so no stale token is served', async () => {
    const s = await bootSession()
    publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    publish({
      phase: 'error',
      user: testFirebaseUser({ uid: 'user-1' }),
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
    const s = await bootSession()
    const popupUser = { uid: 'user-1', getIdToken: async () => 'id-token' }

    await s.ensureFresh(popupUser)

    expect(vi.mocked(workshopSessionClient.ensureFresh)).toHaveBeenCalledWith(
      popupUser,
      expect.objectContaining({ workspaceId: undefined })
    )
  })

  it('restores the remembered workspace after a reload lands on personal', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    vi.mocked(workshopSessionClient.remint).mockResolvedValue({
      status: 'ok',
      session: okSession
    })
    await bootSession()

    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: okSession
    })

    await vi.waitFor(() =>
      expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenCalledWith(
        undefined,
        {
          workspaceId: 'team-9',
          preserveCredentialOnTransientFailure: true
        }
      )
    )
  })

  it('holds the boot snapshot back while the restore is in flight', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    let releaseRemint!: (
      value: Awaited<ReturnType<typeof workshopSessionClient.remint>>
    ) => void
    vi.mocked(workshopSessionClient.remint).mockImplementation(
      () => new Promise((resolve) => (releaseRemint = resolve))
    )
    const s = await bootSession()

    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: okSession
    })

    await vi.waitFor(() =>
      expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenCalledOnce()
    )
    expect(s.session.value, 'the personal boot must not flash').toBeUndefined()
    expect(identifyWorkshopUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: 'user-1' })
    )

    const restored = {
      ...okSession,
      workspace: { id: 'team-9', name: 'Studio', type: 'team' as const }
    }
    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: restored
    })
    releaseRemint({ status: 'ok', session: restored })

    await vi.waitFor(() => expect(s.session.value?.workspace.id).toBe('team-9'))
  })

  it('publishes only the client-owned fallback after a remembered workspace is refused', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    vi.mocked(workshopSessionClient.remint)
      .mockImplementationOnce(async () => {
        publish({
          phase: 'error',
          user: testFirebaseUser({ uid: 'user-1' }),
          session: undefined,
          failure: { status: 'error', code: 'ACCESS_DENIED' }
        })
        return { status: 'error', code: 'ACCESS_DENIED' }
      })
      .mockImplementationOnce(async () => {
        publish(authenticatedSnapshot())
        return { status: 'ok', session: okSession }
      })
    const s = await bootSession()

    publish(authenticatedSnapshot())

    await vi.waitFor(() =>
      expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenCalledTimes(2)
    )
    expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenNthCalledWith(
      2,
      undefined,
      {
        workspaceId: 'ws',
        preserveCredentialOnTransientFailure: true
      }
    )
    expect(s.session.value).toEqual(okSession)
    expect(snapshot).toEqual(authenticatedSnapshot())
  })

  it('keeps a client-owned boot session after a transient restore failure', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    vi.mocked(workshopSessionClient.remint).mockResolvedValue({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
    const s = await bootSession()

    publish(authenticatedSnapshot())

    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    expect(window.localStorage.getItem('workshop:workspace')).toBe(
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
  })

  it('remembers the workspace each authenticated snapshot names', async () => {
    window.localStorage.removeItem('workshop:workspace')
    await bootSession()

    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: {
        ...okSession,
        workspace: { id: 'team-3', name: 'Studio', type: 'team' }
      }
    })

    await vi.waitFor(() =>
      expect(window.localStorage.getItem('workshop:workspace')).toBe(
        JSON.stringify({ uid: 'user-1', workspaceId: 'team-3' })
      )
    )
    expect(vi.mocked(workshopSessionClient.remint)).not.toHaveBeenCalled()
  })

  it('keeps the first workspace the user intentionally switches to', async () => {
    const s = await bootSession()
    publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    vi.mocked(workshopSessionClient.remint).mockResolvedValue({
      status: 'ok',
      session: okSession
    })

    const team = {
      ...okSession,
      workspace: { id: 'team-3', name: 'Studio', type: 'team' as const }
    }
    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: team
    })

    await vi.waitFor(() => expect(s.session.value).toEqual(team))
    expect(
      vi.mocked(workshopSessionClient.remint),
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
    vi.mocked(workshopSessionClient.remint).mockImplementation(
      () => new Promise((resolve) => (finishRestore = resolve))
    )
    const s = await bootSession()
    publish(authenticatedSnapshot())
    await vi.waitFor(() =>
      expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenCalledOnce()
    )

    publish({ phase: 'signed-out', user: null, session: undefined })
    finishRestore(undefined)

    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(s.signedIn.value).toBe(false)
  })

  it('refreshes an errored session for its remembered workspace', async () => {
    const s = await bootSession()
    const team = {
      ...okSession,
      workspace: { id: 'team-3', name: 'Studio', type: 'team' as const }
    }
    publish({
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: team
    })
    await vi.waitFor(() => expect(s.session.value).toEqual(team))
    publish({
      phase: 'error',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: undefined,
      failure: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    })

    await s.ensureFresh()

    expect(vi.mocked(workshopSessionClient.ensureFresh)).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'team-3' })
    )
  })

  it('clears the session on sign-out', async () => {
    const s = await bootSession()
    publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))

    publish({ phase: 'signed-out', user: null, session: undefined })

    await vi.waitFor(() => expect(s.session.value).toBeUndefined())
    expect(s.signedIn.value).toBe(false)
    expect(identifyWorkshopUser).toHaveBeenLastCalledWith(null)
  })

  it('clears the cache when the flag turns off', async () => {
    await bootSession()
    const callsBefore = vi.mocked(workshopSessionClient.clearStoredCredential)
      .mock.calls.length
    const deactivationsBefore = vi.mocked(workshopIdentity.deactivate).mock
      .calls.length

    flag.value = false

    await vi.waitFor(() =>
      expect(
        vi.mocked(workshopSessionClient.clearStoredCredential).mock.calls
          .length,
        'flag-off must drop the cached credential'
      ).toBeGreaterThan(callsBefore)
    )
    expect(
      vi.mocked(workshopIdentity.deactivate).mock.calls.length,
      'flag-off must release the identity'
    ).toBeGreaterThan(deactivationsBefore)
  })

  it('allows remembered-workspace restoration after the flag settles off and turns on again', async () => {
    const s = await bootSession()
    publish(authenticatedSnapshot())
    await vi.waitFor(() => expect(s.session.value).toEqual(okSession))
    flag.value = false
    await vi.waitFor(() =>
      expect(
        vi.mocked(workshopSessionClient.clearStoredCredential)
      ).toHaveBeenCalled()
    )

    vi.mocked(workshopSessionClient.remint).mockResolvedValue({
      status: 'ok',
      session: okSession
    })
    // Activation resolves after delivery, so the host subscribes to the re-minted boot session.
    snapshot = {
      phase: 'authenticated',
      user: testFirebaseUser({ uid: 'user-1' }),
      session: {
        ...okSession,
        workspace: { id: 'personal', name: 'Default', type: 'personal' }
      }
    }
    flag.value = true
    await vi.waitFor(() =>
      expect(vi.mocked(workshopIdentity.activate)).toHaveBeenCalledTimes(2)
    )

    await vi.waitFor(() =>
      expect(
        vi.mocked(workshopSessionClient.remint),
        'settling off ends one auth lifecycle; the next lifecycle must be allowed to restore the remembered workspace for the same uid'
      ).toHaveBeenCalledWith(undefined, {
        workspaceId: 'ws',
        preserveCredentialOnTransientFailure: true
      })
    )
  })

  it('does not resurrect a torn-down session when a restore resolves after the flag turns off', async () => {
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    let signalRemintStarted!: () => void
    const remintStarted = new Promise<void>((resolve) => {
      signalRemintStarted = resolve
    })
    let releaseRemint!: (
      value: Awaited<ReturnType<typeof workshopSessionClient.remint>>
    ) => void
    vi.mocked(workshopSessionClient.remint).mockImplementation(
      () =>
        new Promise((resolve) => {
          signalRemintStarted()
          releaseRemint = resolve
        })
    )
    const s = await bootSession()

    publish(authenticatedSnapshot())
    await remintStarted

    flag.value = false
    await vi.waitFor(() => expect(s.settled.value).toBe(false))

    releaseRemint({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
    await Promise.resolve()
    await Promise.resolve()

    expect(
      s.session.value,
      'a restore the flag flip abandoned must not publish for a lifecycle that no longer owns the outcome'
    ).toBeUndefined()
  })
})
