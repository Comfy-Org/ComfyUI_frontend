import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { AccountUser } from '@comfyorg/account/session'

const STORAGE_KEY = 'comfy.workshop.session.v1'

const h = vi.hoisted(() => ({
  flag: undefined as Ref<boolean> | undefined,
  identifyWorkshopUser: vi.fn(),
  deliver: undefined as ((user: AccountUser | null) => void) | undefined
}))

vi.mock<unknown>(import('../scripts/posthog'), () => ({
  identifyWorkshopUser: h.identifyWorkshopUser,
  useWorkshopAuthFlag: () => h.flag,
  captureAuthRefreshSucceeded: vi.fn(),
  captureAuthRefreshFailed: vi.fn()
}))

vi.mock<unknown>(import('./workshop-firebase'), async () => {
  const { createTestIdentity } = await import('@comfyorg/account/testing')
  return {
    workshopIdentity: createTestIdentity<AccountUser>({
      onUserChanged: (callback) => {
        h.deliver = callback
        return () => {
          h.deliver = undefined
        }
      }
    })
  }
})

const user: AccountUser = { uid: 'user-1', getIdToken: async () => 'id-token' }

function mintBody(token: string) {
  return {
    token,
    permissions: ['workspace:read'],
    expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
}

function okFetch(token = 'jwt-1') {
  return vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(mintBody(token)), { status: 200 })
  )
}

type Phase = 'pending' | 'signed-out' | 'minting' | 'error' | 'authenticated'

async function boot(enabled: boolean) {
  vi.resetModules()
  const flag = ref(enabled)
  h.flag = flag
  const mod = await import('./workshop-session-state')
  const account = await import('./workshop-account')
  const session = mod.useWorkshopSession()
  const phases: Phase[] = []
  const stop = watch(
    (): Phase =>
      !session.settled.value
        ? 'pending'
        : session.user.value === null
          ? 'signed-out'
          : session.signedIn.value
            ? 'authenticated'
            : session.sessionFailure.value
              ? 'error'
              : 'minting',
    (phase) => phases.push(phase),
    { flush: 'sync' }
  )
  onTestFinished(stop)
  return { session, flag, phases, client: account.workshopSessionClient }
}

async function firebaseAnswers(answer: AccountUser | null): Promise<void> {
  await vi.waitFor(() => expect(h.deliver).toBeDefined())
  h.deliver?.(answer)
}

beforeEach(() => {
  sessionStorage.clear()
  window.localStorage.removeItem('workshop:workspace')
  h.deliver = undefined
})

describe('useWorkshopSession over the real session client', () => {
  it('stays unsettled until Firebase delivers, then publishes minting and authenticated', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { session, phases } = await boot(true)
    await vi.waitFor(() => expect(h.deliver).toBeDefined())
    expect(
      session.settled.value,
      'a subscribed but silent Firebase has not answered yet'
    ).toBe(false)

    await firebaseAnswers(user)

    await vi.waitFor(() => expect(session.signedIn.value).toBe(true))
    expect(phases).toEqual(['minting', 'authenticated'])
    expect(h.identifyWorkshopUser).not.toHaveBeenCalledWith(null)
  })

  it('re-enters pending across flag off then on without a signed-out frame', async () => {
    vi.stubGlobal('fetch', okFetch())
    const { session, flag, phases } = await boot(true)
    await firebaseAnswers(user)
    await vi.waitFor(() => expect(session.signedIn.value).toBe(true))
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()

    flag.value = false
    await vi.waitFor(() => expect(session.settled.value).toBe(false))
    expect(
      sessionStorage.getItem(STORAGE_KEY),
      'flag-off must drop the stored credential'
    ).toBeNull()
    flag.value = true
    await firebaseAnswers(user)
    await vi.waitFor(() => expect(session.signedIn.value).toBe(true))

    expect(
      phases,
      'the client is signed out between deactivate and the next delivery; the host must never show it'
    ).not.toContain('signed-out')
    expect(h.identifyWorkshopUser).not.toHaveBeenCalledWith(null)
  })

  it('cannot commit a mint that was in flight when the flag turned off', async () => {
    let releaseMint!: () => void
    const fetchSpy = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          releaseMint = () =>
            resolve(
              new Response(JSON.stringify(mintBody('jwt-late')), {
                status: 200
              })
            )
        })
    )
    vi.stubGlobal('fetch', fetchSpy)
    const { session, flag, phases, client } = await boot(true)
    await firebaseAnswers(user)
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())

    flag.value = false
    await vi.waitFor(() => expect(session.settled.value).toBe(false))
    releaseMint()
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      client.getToken(),
      'a mint the flag flip abandoned must not become the live token'
    ).toBeUndefined()
    expect(phases).not.toContain('authenticated')
    expect(session.signedIn.value).toBe(false)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
