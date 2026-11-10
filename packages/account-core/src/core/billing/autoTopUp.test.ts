import { describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '#/core/session'
import {
  createAutoTopUpReader,
  previewAutoTopUp,
  saveAutoTopUp
} from './autoTopUp'
import type { SaveAutoTopUpInput } from './autoTopUp'
import type {
  BillingHttpResponse,
  BillingResult,
  BillingTransport
} from './billingContracts'
import { sessionBillingScopeSource } from './billingScope'
import {
  authenticated,
  credential,
  fakeTransport,
  httpOk,
  httpStatus
} from './__fixtures__/billingTestFixtures'
import type { SessionFake } from './__fixtures__/billingTestFixtures'

function fakeSession(initial: SessionSnapshot = authenticated(credential())) {
  let snapshot = initial
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    scopeSource: sessionBillingScopeSource(fake),
    moveToTeam() {
      snapshot = authenticated(
        credential({ workspace: { id: 'ws-2', name: 'Team', type: 'team' } })
      )
      for (const listener of Array.from(listeners)) listener(snapshot)
    }
  }
}

const SETTINGS = {
  card_expiring_soon: false,
  card_expiry: { expired: false, month: 4, year: 2030 },
  configured: true,
  cycle_resets_at: '2026-11-01T00:00:00Z',
  declined_payment_method: null,
  disabled_reason: null,
  enabled: true,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100_000,
  max_reload_credits: 50_000,
  min_reload_credits: 500,
  monthly_budget_cents: 20_000,
  monthly_budget_is_default: false,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: 1_000,
  reload_credits: 2_000,
  spent_this_cycle_cents: 3_000,
  status: 'on',
  target_credits: 3_000,
  threshold_credits: 1_000
}

const SAVE_INPUT: SaveAutoTopUpInput = {
  enabled: true,
  monthly_budget_cents: 20_000,
  target_credits: 3_000,
  threshold_credits: 1_000
}

function refusal(
  status: number,
  code: string
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: {
      httpStatus: status,
      body: { code, message: `refused: ${code}` },
      header: () => null
    }
  }
}

function gatedTransport(answers: BillingResult<BillingHttpResponse>[]) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  const transport: BillingTransport = vi.fn(async () => {
    const answer = answers[Math.min(calls, answers.length - 1)]
    calls++
    if (calls === 1) await gate
    return answer
  })
  return { transport, release: () => release() }
}

describe('createAutoTopUpReader', () => {
  it('reads the settings from the auto-reload route with int64 fields as numbers', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(SETTINGS)])

    const result = await createAutoTopUpReader({
      transport,
      scopeSource,
      now: () => 1_700
    }).read({ timeoutMs: 5_000 })

    expect(calls).toEqual([
      { method: 'GET', route: '/billing/auto-reload', timeoutMs: 5_000 }
    ])
    expect(result).toEqual({
      status: 'ok',
      value: {
        scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
        settings: SETTINGS,
        readAt: 1_700
      }
    })
  })

  it('serves concurrent reads of one scope from a single request', async () => {
    const { scopeSource } = fakeSession()
    const { transport, calls } = fakeTransport([httpOk(SETTINGS)])
    const reader = createAutoTopUpReader({ transport, scopeSource })

    const [first, second] = await Promise.all([reader.read(), reader.read()])

    expect(calls).toHaveLength(1)
    expect(first).toEqual(second)
  })

  it('reports a read the workspace change overtook as superseded', async () => {
    const host = fakeSession()
    const { transport, release } = gatedTransport([httpOk(SETTINGS)])
    const reader = createAutoTopUpReader({
      transport,
      scopeSource: host.scopeSource
    })

    const pending = reader.read()
    host.moveToTeam()
    release()

    expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
    expect(reader.getSnapshot()).toBeUndefined()
  })

  it('reports a body with a fractional credit count as malformed', async () => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([
      httpOk({ ...SETTINGS, threshold_credits: 10.5 })
    ])

    const result = await createAutoTopUpReader({
      transport,
      scopeSource
    }).read()

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
  })

  it.for([
    [401, 'ACCESS_DENIED'],
    [403, 'ACCESS_DENIED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'REQUEST_FAILED'],
    [500, 'REQUEST_FAILED'],
    [503, 'REQUEST_FAILED']
  ] as const)('maps %i to %s', async ([status, code]) => {
    const { scopeSource } = fakeSession()
    const { transport } = fakeTransport([httpStatus(status)])

    const result = await createAutoTopUpReader({
      transport,
      scopeSource
    }).read()

    expect(result).toEqual({ status: 'error', code, httpStatus: status })
  })

  it('drops the published settings on invalidate and keeps an older read from republishing them', async () => {
    const { scopeSource } = fakeSession()
    const disabled = { ...SETTINGS, enabled: false, status: 'off' }
    const { transport, release } = gatedTransport([
      httpOk(SETTINGS),
      httpOk(disabled)
    ])
    const reader = createAutoTopUpReader({ transport, scopeSource })

    const stale = reader.read()
    reader.invalidate()
    const fresh = await reader.read()
    release()
    await stale

    expect(transport).toHaveBeenCalledTimes(2)
    expect(fresh).toMatchObject({ value: { settings: { enabled: false } } })
    expect(reader.getSnapshot()?.settings.enabled).toBe(false)

    reader.invalidate()

    expect(reader.getSnapshot()).toBeUndefined()
  })
})

describe('saveAutoTopUp', () => {
  it('sends the generated request body as a PUT and returns the stored settings', async () => {
    const { transport, calls } = fakeTransport([httpOk(SETTINGS)])

    const result = await saveAutoTopUp(transport, SAVE_INPUT, {
      timeoutMs: 5_000
    })

    expect(calls).toEqual([
      {
        method: 'PUT',
        route: '/billing/auto-reload',
        body: SAVE_INPUT,
        timeoutMs: 5_000
      }
    ])
    expect(result).toEqual({ status: 'ok', value: SETTINGS })
  })

  it('sends no idempotency key, so a stale token is reported rather than replayed', async () => {
    const { transport, calls } = fakeTransport([
      {
        status: 'ok',
        value: {
          httpStatus: 401,
          body: {},
          header: () => null,
          authenticationRetrySkipped: true
        }
      }
    ])

    const result = await saveAutoTopUp(transport, SAVE_INPUT)

    expect(calls[0].idempotencyKey).toBeUndefined()
    expect(result).toEqual({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 401
    })
  })

  it.for([
    [400, 'INVALID_AUTO_TOP_UP', 'REQUEST_FAILED'],
    [409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS', 'CONFLICT'],
    [422, 'AUTO_TOP_UP_NOT_ELIGIBLE', 'REQUEST_FAILED'],
    [500, 'AUTO_TOP_UP_DISABLED_ACCOUNTING_UNAVAILABLE', 'REQUEST_FAILED']
  ] as const)(
    'returns a %i %s refusal as %s with the server code',
    async ([status, serverCode, code]) => {
      const { transport } = fakeTransport([refusal(status, serverCode)])

      const result = await saveAutoTopUp(transport, SAVE_INPUT)

      expect(result).toEqual({
        status: 'error',
        code,
        httpStatus: status,
        serverCode,
        serverMessage: `refused: ${serverCode}`
      })
    }
  )

  it('refuses a fractional credit count without sending anything', async () => {
    const { transport } = fakeTransport([httpOk(SETTINGS)])

    const result = await saveAutoTopUp(transport, {
      ...SAVE_INPUT,
      threshold_credits: 10.5
    })

    expect(result).toEqual({ status: 'error', code: 'INVALID_REQUEST' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('reports a stored-settings body that misses the contract as malformed', async () => {
    const { transport } = fakeTransport([httpOk({ enabled: true })])

    const result = await saveAutoTopUp(transport, SAVE_INPUT)

    expect(result).toEqual({
      status: 'error',
      code: 'MALFORMED_RESPONSE',
      httpStatus: 200
    })
  })
})

describe('previewAutoTopUp', () => {
  const CHARGES_NOW = {
    charge_cents: 1_000,
    charge_credits: 2_000,
    charges_now: true,
    not_charging_reason: 'above_threshold'
  }

  it.for([
    [
      'with a budget',
      {
        threshold_credits: 1_000,
        target_credits: 3_000,
        monthly_budget_cents: 20_000
      },
      '/billing/auto-reload/preview?threshold_credits=1000&target_credits=3000&monthly_budget_cents=20000'
    ],
    [
      'without a budget',
      { threshold_credits: 1_000, target_credits: 3_000 },
      '/billing/auto-reload/preview?threshold_credits=1000&target_credits=3000'
    ]
  ] as const)('encodes the query %s', async ([, query, route]) => {
    const { transport, calls } = fakeTransport([httpOk(CHARGES_NOW)])

    await previewAutoTopUp(transport, query)

    expect(calls).toEqual([{ method: 'GET', route }])
  })

  it.for([
    ['charges now', CHARGES_NOW],
    [
      'does not charge now',
      {
        charge_cents: null,
        charge_credits: null,
        charges_now: false,
        not_charging_reason: 'above_threshold'
      }
    ]
  ] as const)('returns the estimate when saving %s', async ([, estimate]) => {
    const { transport } = fakeTransport([httpOk(estimate)])

    const result = await previewAutoTopUp(transport, {
      threshold_credits: 1_000,
      target_credits: 3_000
    })

    expect(result).toEqual({ status: 'ok', value: estimate })
  })

  it.for([
    [422, 'AUTO_TOP_UP_NOT_ELIGIBLE', 'REQUEST_FAILED'],
    [409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS', 'CONFLICT'],
    [503, 'AUTO_TOP_UP_PREVIEW_UNAVAILABLE', 'REQUEST_FAILED']
  ] as const)(
    'returns a %i %s refusal as %s instead of throwing',
    async ([status, serverCode, code]) => {
      const { transport } = fakeTransport([refusal(status, serverCode)])

      const result = await previewAutoTopUp(transport, {
        threshold_credits: 1_000,
        target_credits: 3_000
      })

      expect(result).toEqual({
        status: 'error',
        code,
        httpStatus: status,
        serverCode,
        serverMessage: `refused: ${serverCode}`
      })
    }
  )

  it('refuses a fractional threshold without sending anything', async () => {
    const { transport } = fakeTransport([httpOk(CHARGES_NOW)])

    const result = await previewAutoTopUp(transport, {
      threshold_credits: 10.5,
      target_credits: 3_000
    })

    expect(result).toEqual({ status: 'error', code: 'INVALID_REQUEST' })
    expect(transport).not.toHaveBeenCalled()
  })
})
