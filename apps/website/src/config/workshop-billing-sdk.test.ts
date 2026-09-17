import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const account = vi.hoisted(() => {
  const credential: AccountCredential = {
    token: 'workspace-jwt',
    expiresAt: Number.MAX_SAFE_INTEGER,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read']
  }
  const snapshot: SessionSnapshot = {
    phase: 'authenticated',
    user: {
      uid: credential.uid,
      getIdToken: () => Promise.resolve('id-token')
    },
    session: credential
  }
  const ensureFresh = vi.fn()
  const remint = vi.fn()
  return {
    credential,
    ensureFresh,
    client: {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
      ensureFresh,
      remint
    }
  }
})

vi.mock<unknown>(import('./workshop-account'), () => ({
  workshopSessionClient: account.client
}))

const CHECKOUT = {
  checkout_url: 'https://checkout.stripe.com/c/pay_1',
  session_id: 's_1'
}

const CHECKOUT_URL = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/topup/checkout`

const RETURN_URL =
  'https://www.comfy.org/checkout-return?workshopTopUpReturn=attempt-1'

const CLOUD_BODIES: Readonly<Record<string, unknown>> = {
  [`${WORKSHOP_CLOUD_BASE_URL}/api/billing/capabilities`]: {
    capabilities: {
      can_cancel: false,
      can_change_seats: false,
      can_downgrade_to_personal: false,
      can_invite_members: false,
      can_reactivate: false,
      can_subscribe_self_serve: false,
      can_top_up: true
    },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    }
  },
  [`${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`]: {
    amount_micros: 12_500_000,
    currency: 'USD'
  },
  [CHECKOUT_URL]: CHECKOUT
}

function stubCloudFetch() {
  const fetchCloud = vi.fn<typeof fetch>((input) => {
    const body = CLOUD_BODIES[String(input)]
    return Promise.resolve(
      body === undefined
        ? new Response(null, { status: 404 })
        : new Response(JSON.stringify(body))
    )
  })
  vi.stubGlobal('fetch', fetchCloud)
  return fetchCloud
}

async function importFresh() {
  vi.resetModules()
  return import('./workshop-billing-sdk')
}

async function openHostedCheckout() {
  const fetchCloud = stubCloudFetch()
  const { workshopTopupCommand } = await importFresh()
  const result = await workshopTopupCommand().createHostedTopupCheckout({
    amountCents: 5_000,
    returnUrl: RETURN_URL
  })
  return { fetchCloud, result }
}

function requestTo(calls: readonly Parameters<typeof fetch>[], url: string) {
  const call = calls.find(([target]) => String(target) === url)
  if (call === undefined) throw new Error(`no request to ${url}`)
  const body: unknown = JSON.parse(String(call[1]?.body))
  return { init: call[1] ?? {}, headers: new Headers(call[1]?.headers), body }
}

beforeEach(() => {
  account.ensureFresh.mockResolvedValue({
    status: 'ok',
    session: account.credential
  })
})

describe('workshopTopupCommand', () => {
  it('builds the top-up command once for the page', async () => {
    const { workshopTopupCommand } = await importFresh()

    expect(workshopTopupCommand()).toBe(workshopTopupCommand())
  })

  it('posts the hosted checkout to Cloud under one authorized idempotency key', async () => {
    const { fetchCloud, result } = await openHostedCheckout()

    expect(result).toMatchObject({
      status: 'ok',
      url: CHECKOUT.checkout_url,
      sessionId: CHECKOUT.session_id
    })
    const checkout = requestTo(fetchCloud.mock.calls, CHECKOUT_URL)
    expect(checkout.init.method).toBe('POST')
    expect(checkout.headers.get('Authorization')).toBe('Bearer workspace-jwt')
    expect(checkout.headers.get('Idempotency-Key')).toEqual(expect.any(String))
    expect(checkout.body).toEqual({
      amount_cents: 5_000,
      return_url: RETURN_URL,
      idempotency_key: checkout.headers.get('Idempotency-Key')
    })
  })

  it('mints for the workspace the session currently holds', async () => {
    await openHostedCheckout()

    expect(account.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-1' })
    )
  })
})
