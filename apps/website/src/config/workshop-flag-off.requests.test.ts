/**
 * With `unified_web_session` not on, the website's whole account path sends
 * main's requests and nothing else: boot, both balance readers, a direct
 * session freshness check, a refocus and sign-out, over the real account modules with
 * only Firebase and the flag mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { User } from 'firebase/auth'

import { mintBody, testFirebaseUser } from './__fixtures__/workshopSessionFakes'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-firebase'))

const CLOUD = WORKSHOP_CLOUD_BASE_URL

interface SentRequest {
  readonly method: string
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly authorization?: string
  readonly client?: string
  readonly headers: readonly string[]
  readonly body?: unknown
}

const ANONYMOUS_FEATURES_READ: SentRequest = {
  method: 'GET',
  url: `${CLOUD}/api/features`,
  headers: [],
  credentials: 'omit'
}

const CREDENTIALED_FEATURES_READ: SentRequest = {
  method: 'GET',
  url: `${CLOUD}/api/features`,
  headers: ['x-comfy-client'],
  credentials: 'include',
  client: expect.stringMatching(/^@comfyorg\/account-core\//)
}

const TOKEN_MINT: SentRequest = {
  method: 'POST',
  url: `${CLOUD}/api/auth/token`,
  headers: ['authorization', 'content-type'],
  authorization: 'Bearer id-token',
  body: {}
}

const BALANCE_READ: SentRequest = {
  method: 'GET',
  url: `${CLOUD}/api/billing/balance`,
  headers: ['authorization'],
  authorization: 'Bearer jwt-1'
}

const RUN_MINT: SentRequest = {
  ...TOKEN_MINT,
  body: { workspace_id: 'ws-1' }
}

const BOOT_AND_BALANCES = [TOKEN_MINT, BALANCE_READ]
const REFOCUS = [BALANCE_READ]
const AFTER_RUN = [...BOOT_AND_BALANCES, RUN_MINT]

function recordRequest(url: string, init: RequestInit = {}): SentRequest {
  const headers = new Headers(init.headers)
  return {
    method: init.method ?? 'GET',
    url,
    headers: [...headers.keys()].map((name) => name.toLowerCase()).sort(),
    ...(init.credentials ? { credentials: init.credentials } : {}),
    ...(headers.has('Authorization')
      ? { authorization: headers.get('Authorization') ?? undefined }
      : {}),
    ...(headers.has('X-Comfy-Client')
      ? { client: headers.get('X-Comfy-Client') ?? undefined }
      : {}),
    ...(typeof init.body === 'string' ? { body: JSON.parse(init.body) } : {})
  }
}

function stubCloud(
  anonymous: Record<string, unknown>,
  perUser: Record<string, unknown>
) {
  const sent: SentRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      sent.push(recordRequest(url, init))
      const body = url.endsWith('/api/auth/token')
        ? mintBody('jwt-1')
        : url.endsWith('/api/billing/balance')
          ? {
              amount_micros: 211,
              currency: 'usd',
              effective_balance_micros: 211
            }
          : init?.credentials === 'include'
            ? perUser
            : anonymous
      return new Response(JSON.stringify(body))
    })
  )
  return sent
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) {
    await vi.dynamicImportSettled()
    await new Promise((resolve) => setImmediate(resolve))
  }
}

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

describe('website with unified_web_session not on', () => {
  it.for([
    {
      name: 'probe absent',
      anonymous: {},
      perUser: { unified_web_session: true },
      features: [ANONYMOUS_FEATURES_READ]
    },
    {
      name: 'web_session_probe false',
      anonymous: { web_session_probe: false },
      perUser: { unified_web_session: true },
      features: [ANONYMOUS_FEATURES_READ]
    },
    {
      name: 'probe true, unified_web_session false',
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: false },
      features: [ANONYMOUS_FEATURES_READ, CREDENTIALED_FEATURES_READ]
    },
    {
      name: 'probe true, unified_web_session "true" (a string)',
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: 'true' },
      features: [ANONYMOUS_FEATURES_READ, CREDENTIALED_FEATURES_READ]
    }
  ])(
    '$name: boot, both balances, a session freshness check, a refocus and sign-out send main’s requests',
    async ({ anonymous, perUser, features }) => {
      const sent = stubCloud(anonymous, perUser)
      const posthog = await import('../scripts/posthog')
      vi.mocked(posthog.useWorkshopAuthFlag).mockReturnValue(
        readonly(ref(true))
      )
      const { workshopIdentity } = await import('./workshop-firebase')
      let deliver: ((user: User | null) => void) | undefined
      vi.mocked(workshopIdentity.onUserChanged).mockImplementation(
        (callback) => {
          deliver = callback
          return () => {
            deliver = undefined
          }
        }
      )
      const { useWorkshopSession } = await import('./workshop-session-state')
      const { useWorkshopCredits } = await import('./workshop-credits')
      const { useWorkshopModelBalance } =
        await import('./workshop-model-balance')

      const session = useWorkshopSession()
      const header = useWorkshopCredits()
      const modelPage = useWorkshopModelBalance(session.session)
      await settle()
      deliver?.(testFirebaseUser({ uid: 'uid-1' }))
      await settle()

      expect(header.balance.value.status).toBe('ok')
      expect(modelPage.value).toEqual(header.balance.value)
      await session.ensureFresh(undefined, { workspaceId: 'ws-1' })
      await settle()
      expect(sent).toEqual([...features, ...AFTER_RUN])

      window.dispatchEvent(new Event('focus'))
      await settle()
      expect(sent).toEqual([...features, ...AFTER_RUN, ...REFOCUS])

      deliver?.(null)
      await settle()
      expect(sent).toEqual([...features, ...AFTER_RUN, ...REFOCUS])
      expect(session.signedIn.value).toBe(false)
      expect(sent.map(({ url }) => url)).not.toContain(
        `${CLOUD}/api/auth/session`
      )
    }
  )
})
