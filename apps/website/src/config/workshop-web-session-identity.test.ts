import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testFirebaseUser } from './__fixtures__/workshopSessionFakes'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-firebase'))

const SESSION = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/session`

interface Answer {
  readonly status: number
  readonly body: unknown
}

function liveSession(userId: string): Answer {
  return {
    status: 200,
    body: {
      absolute_expires_at: '2099-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      csrf_token: 'csrf',
      user: { id: userId, email: 'a@b.c', email_verified: true }
    }
  }
}

const NO_SESSION: Answer = {
  status: 401,
  body: { code: 'no_session', message: 'no session' }
}

/** Flag on; each session request takes the next answer, the last repeating. */
function stubCloud(...sessionAnswers: Answer[]) {
  const sessionRequests: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init = {}) => {
      if (String(input) !== SESSION) {
        const flags = init.credentials
          ? { unified_web_session: true }
          : { web_session_probe: true }
        return new Response(JSON.stringify(flags))
      }
      sessionRequests.push(init)
      const answer =
        sessionAnswers[
          Math.min(sessionRequests.length, sessionAnswers.length) - 1
        ]
      return new Response(JSON.stringify(answer.body), {
        status: answer.status
      })
    })
  )
  return sessionRequests
}

async function loadModules(firebaseUid: string | undefined) {
  const firebase = await import('./workshop-firebase')
  const firebaseSubscribe = vi.mocked(firebase.workshopIdentity.onUserChanged)
  firebaseSubscribe.mockImplementation((callback) => {
    callback(firebaseUid ? testFirebaseUser({ uid: firebaseUid }) : null)
    return () => {}
  })
  const { workshopIdentity } = await import('./workshop-account')
  return {
    signOutWorkshop: vi.mocked(firebase.signOutWorkshop),
    firebaseSubscribe,
    loadFirebase: () => workshopIdentity.activate(),
    ...(await import('./workshop-web-session-identity'))
  }
}

beforeEach(() => {
  vi.resetModules()
})

describe('resolveWorkshopAccountSource with the flag on', () => {
  it.for([
    { remembered: 'nothing loaded', firebaseUid: undefined, signOuts: 0 },
    { remembered: 'the same user', firebaseUid: 'uid-1', signOuts: 0 },
    { remembered: 'a different user', firebaseUid: 'uid-2', signOuts: 1 }
  ])(
    'shows a live session when Firebase remembers $remembered',
    async ({ firebaseUid, signOuts }) => {
      stubCloud(liveSession('uid-1'))
      const modules = await loadModules(firebaseUid)
      if (firebaseUid) await modules.loadFirebase()

      expect(await modules.resolveWorkshopAccountSource()).toBe('session')
      expect(modules.useWorkshopSessionAccount().value?.id).toBe('uid-1')
      await vi.waitFor(() =>
        expect(modules.signOutWorkshop).toHaveBeenCalledTimes(signOuts)
      )
    }
  )

  it('never loads Firebase to answer who is remembered', async () => {
    stubCloud(liveSession('uid-1'))
    const { resolveWorkshopAccountSource, firebaseSubscribe } =
      await loadModules('uid-1')

    expect(await resolveWorkshopAccountSource()).toBe('session')
    expect(firebaseSubscribe).not.toHaveBeenCalled()
  })

  it('does not restore without a loaded Firebase login, and falls back to it', async () => {
    const sessionRequests = stubCloud(NO_SESSION)
    const { resolveWorkshopAccountSource } = await loadModules('uid-1')

    expect(await resolveWorkshopAccountSource()).toBe('firebase')
    expect(sessionRequests.map(({ method }) => method)).toEqual(['GET'])
  })

  it('restores the session from a loaded Firebase login', async () => {
    const sessionRequests = stubCloud(
      NO_SESSION,
      { status: 200, body: { success: true } },
      liveSession('uid-1')
    )
    const { resolveWorkshopAccountSource, loadFirebase } =
      await loadModules('uid-1')
    await loadFirebase()

    expect(await resolveWorkshopAccountSource()).toBe('session')
    expect(sessionRequests.map(({ method }) => method)).toEqual([
      'GET',
      'POST',
      'GET'
    ])
    expect(sessionRequests[1].headers).toEqual({
      Authorization: 'Bearer id-token'
    })
  })
})
