/**
 * Every request the header sends before it shows an account, per rollout
 * state. Flag off, main's header plus the one plain probe; flag on with a
 * live session, the session's account with no Firebase island mounted.
 */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '../../../config/workshop-env'
import { ACCOUNT_SOURCE_CAP_MS } from '../../../config/workshop-account-source'

vi.mock(import('../../../scripts/posthog'))
vi.mock(import('../../../config/workshop-session-state'))
vi.mock(import('../../../config/workshop-credits'))
vi.mock(import('../../../config/workshop-billing-sdk'))
vi.mock(import('../../../config/workshop-features'))
vi.mock(import('../../../config/workshop-firebase'))

const FEATURES = `${WORKSHOP_CLOUD_BASE_URL}/api/features`
const SESSION = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/session`

interface SentRequest {
  readonly method: string
  readonly url: string
  readonly credentials?: RequestCredentials
}

const ANONYMOUS_PROBE: SentRequest = {
  method: 'GET',
  url: FEATURES,
  credentials: 'omit'
}
const CREDENTIALED_FLAGS: SentRequest = {
  method: 'GET',
  url: FEATURES,
  credentials: 'include'
}
const SESSION_READ: SentRequest = {
  method: 'GET',
  url: SESSION,
  credentials: 'include'
}

const LIVE_SESSION = {
  status: 200,
  body: {
    absolute_expires_at: '2099-01-01T00:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
    csrf_token: 'csrf',
    user: {
      id: 'uid-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada Lovelace'
    }
  }
}

function refusal(code: string) {
  return { status: 401, body: { code, message: code } }
}

interface CloudAnswers {
  readonly anonymous: Record<string, unknown>
  readonly perUser?: Record<string, unknown>
  readonly session?: { readonly status: number; readonly body: unknown }
  /** Every answer waits for it; a pending one is a hung Cloud. */
  readonly answered?: Promise<void>
}

function stubCloud({
  anonymous,
  perUser = {},
  session,
  answered
}: CloudAnswers) {
  const sent: SentRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      const { credentials } = init ?? {}
      sent.push({
        method: init?.method ?? 'GET',
        url,
        ...(credentials ? { credentials } : {})
      })
      await answered
      const answer =
        url === SESSION
          ? (session ?? refusal('no_session'))
          : {
              status: 200,
              body: credentials === 'include' ? perUser : anonymous
            }
      return new Response(JSON.stringify(answer.body), {
        status: answer.status
      })
    })
  )
  return sent
}

async function renderHeader() {
  const posthog = await import('../../../scripts/posthog')
  vi.mocked(posthog.useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  const { default: HeaderMain } = await import('./HeaderMain.vue')
  render(HeaderMain, { props: { workshopInBuild: true } })
  const { useWorkshopSession } =
    await import('../../../config/workshop-session-state')
  return { useWorkshopSession: vi.mocked(useWorkshopSession) }
}

beforeEach(() => {
  vi.resetModules()
})

describe('HeaderMain account source', () => {
  it.for([
    {
      state: 'probe absent',
      answers: { anonymous: {} },
      requests: [ANONYMOUS_PROBE]
    },
    {
      state: 'probe false',
      answers: { anonymous: { web_session_probe: false } },
      requests: [ANONYMOUS_PROBE]
    },
    {
      state: 'probe on, unified_web_session false',
      answers: {
        anonymous: { web_session_probe: true },
        perUser: { unified_web_session: false }
      },
      requests: [ANONYMOUS_PROBE, CREDENTIALED_FLAGS]
    },
    {
      state: 'flag on, no session',
      answers: {
        anonymous: { web_session_probe: true },
        perUser: { unified_web_session: true }
      },
      requests: [ANONYMOUS_PROBE, CREDENTIALED_FLAGS, SESSION_READ]
    }
  ])(
    '$state: shows the Firebase header after exactly these requests',
    async ({ answers, requests }) => {
      const sent = stubCloud(answers)
      const { useWorkshopSession } = await renderHeader()

      expect(
        await screen.findAllByRole('link', { name: /sign in/i })
      ).toHaveLength(2)
      expect(useWorkshopSession).toHaveBeenCalled()
      expect(sent).toEqual(requests)
    }
  )

  it('flag on with a live session: shows the session account and never starts Firebase', async () => {
    const sent = stubCloud({
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: true },
      session: LIVE_SESSION
    })
    const { useWorkshopSession } = await renderHeader()

    const accounts = await screen.findAllByRole('img', {
      name: 'Account, ada@example.com'
    })
    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toHaveTextContent('AL')
    expect(
      useWorkshopSession,
      'neither the header nor the credits dialog may start the Firebase lifecycle'
    ).not.toHaveBeenCalled()
    expect(sent).toEqual([ANONYMOUS_PROBE, CREDENTIALED_FLAGS, SESSION_READ])
    expect(
      sent.filter(({ url }) => /identitytoolkit|securetoken/.test(url))
    ).toEqual([])
  })

  it('flag on with a revoked session: signs the remembered login out and falls back to Firebase', async () => {
    stubCloud({
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: true },
      session: refusal('session_revoked')
    })
    await renderHeader()

    expect(
      await screen.findAllByRole('link', { name: /sign in/i })
    ).toHaveLength(2)
    const { signOutWorkshop } =
      await import('../../../config/workshop-firebase')
    expect(vi.mocked(signOutWorkshop)).toHaveBeenCalledOnce()
  })

  describe('decision cap', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
    })

    it('mounts the Firebase header at the cap while the probe hangs, and never swaps', async () => {
      const cloud = Promise.withResolvers<void>()
      const sent = stubCloud({
        anonymous: { web_session_probe: true },
        perUser: { unified_web_session: true },
        session: LIVE_SESSION,
        answered: cloud.promise
      })
      await renderHeader()

      await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS - 1)
      expect(screen.queryAllByRole('link', { name: /sign in/i })).toEqual([])

      await vi.advanceTimersByTimeAsync(1)
      await vi.waitFor(() =>
        expect(screen.getAllByRole('link', { name: /sign in/i })).toHaveLength(
          2
        )
      )

      cloud.resolve()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(
        screen.getAllByRole('link', { name: /sign in/i }),
        'a live session answering late must not swap out a mounted Firebase header'
      ).toHaveLength(2)
      expect(screen.queryAllByTestId('header-session-account')).toEqual([])
      expect(
        sent.map(({ url }) => url),
        'a flag answering after the cap must not start a session read'
      ).not.toContain(SESSION)
    })

    it('mounts the Firebase header without waiting for the cap when the probe is off', async () => {
      stubCloud({ anonymous: { web_session_probe: false } })
      const start = Date.now()
      await renderHeader()

      await vi.waitFor(() =>
        expect(screen.getAllByRole('link', { name: /sign in/i })).toHaveLength(
          2
        )
      )
      expect(
        Date.now() - start,
        'vi.waitFor advances fake time, so this bounds how long the header waited'
      ).toBeLessThan(ACCOUNT_SOURCE_CAP_MS)
    })
  })
})
