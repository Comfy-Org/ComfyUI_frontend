/**
 * Pins every request the website sends to Cloud `/api/features`. Main sends
 * only the signed-in Bearer read; the reader adds one plain anonymous GET
 * while the probe is off, and one credentialed read only when it is on.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SessionClient } from '@comfyorg/account-core/session'

import { createBillingSdkTopupReader } from './workshop-features'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const FEATURES_URL = `${WORKSHOP_CLOUD_BASE_URL}/api/features`

interface SentRequest {
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly cache?: RequestCache
  readonly headers?: HeadersInit
}

const MAIN_BEARER_READ: SentRequest = {
  url: FEATURES_URL,
  cache: 'no-store',
  headers: { Authorization: 'Bearer uid-1-jwt' }
}

const PLAIN_ANONYMOUS_READ: SentRequest = {
  url: FEATURES_URL,
  credentials: 'omit'
}

const CREDENTIALED_READ: SentRequest = {
  url: FEATURES_URL,
  credentials: 'include',
  cache: 'no-store',
  headers: {
    'X-Comfy-Client': expect.stringMatching(/^@comfyorg\/account-core\//)
  }
}

const SIGNED_IN: Pick<SessionClient, 'getSnapshot'> = {
  getSnapshot: () => ({
    phase: 'authenticated',
    user: { uid: 'uid-1', getIdToken: () => Promise.resolve('id-token') },
    session: {
      token: 'uid-1-jwt',
      expiresAt: Number.MAX_SAFE_INTEGER,
      uid: 'uid-1',
      workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
      role: 'owner',
      permissions: []
    }
  })
}

function recordingFetch(
  anonymous: Record<string, unknown>,
  perUser: Record<string, unknown>
) {
  const sent: Array<Record<string, unknown>> = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const { credentials, cache, headers } = init ?? {}
    sent.push(
      Object.fromEntries(
        Object.entries({
          url: String(input),
          credentials,
          cache,
          headers
        }).filter(([, value]) => value !== undefined)
      )
    )
    const body = credentials === 'include' ? perUser : anonymous
    return new Response(JSON.stringify(body))
  })
  return { sent, fetchImpl }
}

async function freshReader() {
  vi.resetModules()
  const { readUnifiedWebSessionEnabled } =
    await import('./workshop-web-session')
  return readUnifiedWebSessionEnabled
}

describe('website unified_web_session reader', () => {
  it('main sends only the signed-in Bearer read', async () => {
    const { sent, fetchImpl } = recordingFetch({}, {})

    await createBillingSdkTopupReader(SIGNED_IN, FEATURES_URL, fetchImpl)()

    expect(sent).toEqual([MAIN_BEARER_READ])
  })

  it.for([
    {
      name: 'probe absent',
      anonymous: {},
      perUser: { unified_web_session: true },
      added: [PLAIN_ANONYMOUS_READ],
      enabled: false
    },
    {
      name: 'probe false',
      anonymous: { web_session_probe: false },
      perUser: { unified_web_session: true },
      added: [PLAIN_ANONYMOUS_READ],
      enabled: false
    },
    {
      name: 'probe true, flag false',
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: false },
      added: [PLAIN_ANONYMOUS_READ, CREDENTIALED_READ],
      enabled: false
    },
    {
      name: 'probe true, flag true',
      anonymous: { web_session_probe: true },
      perUser: { unified_web_session: true },
      added: [PLAIN_ANONYMOUS_READ, CREDENTIALED_READ],
      enabled: true
    }
  ])(
    '$name: adds exactly $added.length request(s) to main, once per page load',
    async ({ anonymous, perUser, added, enabled }) => {
      const { sent, fetchImpl } = recordingFetch(anonymous, perUser)
      vi.stubGlobal('fetch', fetchImpl)
      const readUnifiedWebSessionEnabled = await freshReader()

      const first = await readUnifiedWebSessionEnabled()
      const second = await readUnifiedWebSessionEnabled()
      await createBillingSdkTopupReader(SIGNED_IN, FEATURES_URL, fetchImpl)()

      expect([first, second]).toEqual([enabled, enabled])
      expect(sent).toEqual([...added, MAIN_BEARER_READ])
    }
  )

  it('is off, and never throws, when Cloud is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const readUnifiedWebSessionEnabled = await freshReader()

    await expect(readUnifiedWebSessionEnabled()).resolves.toBe(false)
  })
})
