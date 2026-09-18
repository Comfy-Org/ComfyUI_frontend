import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type {
  AccountUser,
  SessionSnapshot
} from '@comfyorg/account-core/session'

import {
  mintBody,
  okFetch,
  testUser
} from './__fixtures__/workshopSessionFakes'
import { STORAGE_KEY } from './workshop-account'
import { REMEMBERED_WORKSPACE_KEY } from './workshop-session-state'

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
  const { createTestIdentity } = await import('@comfyorg/account-core/testing')
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

const user = testUser('user-1')

type Phase = SessionSnapshot['phase']

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
  window.localStorage.removeItem(REMEMBERED_WORKSPACE_KEY)
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
    await fetchSpy.mock.results[0]?.value
    await new Promise((resolve) => setTimeout(resolve))

    expect(client.getToken()).toBeUndefined()
    expect(phases).not.toContain('authenticated')
    expect(session.signedIn.value).toBe(false)
    expect(
      sessionStorage.getItem(STORAGE_KEY),
      'a mint the flag flip abandoned must not be committed to storage'
    ).toBeNull()
  })

  it('installs nothing when the flag turns off before the first Firebase answer lands', async () => {
    const fetchSpy = okFetch()
    vi.stubGlobal('fetch', fetchSpy)
    const { session, flag, phases, client } = await boot(true)
    await vi.waitFor(() => expect(h.deliver).toBeDefined())

    flag.value = false
    h.deliver?.(user)
    await vi.waitFor(() => expect(h.deliver).toBeUndefined())
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      client.getSnapshot().phase,
      'the delivery landed on the client, so the flag-off deactivate delivered null'
    ).toBe('signed-out')
    expect(
      phases,
      'a begin resumed by the flag-off deactivate must not subscribe the host'
    ).toEqual([])
    expect(session.settled.value).toBe(false)
    expect(h.identifyWorkshopUser).not.toHaveBeenCalled()
  })

  it('clears the stored credential when a begin step fails after a signed-in delivery', async () => {
    // The replayed minting snapshot reaches identify inside begin, so its
    // throw fails a begin step after the signed-in delivery.
    h.identifyWorkshopUser.mockImplementationOnce(() => {
      throw new Error('identify exploded')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { expires_at, ...cached } = mintBody('jwt-cached')
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...cached,
        uid: user.uid,
        expiresAt: Date.parse(expires_at)
      })
    )
    const fetchSpy = okFetch()
    vi.stubGlobal('fetch', fetchSpy)
    await boot(true)

    await firebaseAnswers(user)
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      fetchSpy,
      'the seeded credential was served from cache, so the boot never minted'
    ).not.toHaveBeenCalled()
    expect(
      sessionStorage.getItem(STORAGE_KEY),
      'the failed attempt signs the client out, so the retry re-mints instead of reviving this credential'
    ).toBeNull()
  })
})
