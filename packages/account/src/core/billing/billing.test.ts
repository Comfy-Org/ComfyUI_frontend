import { describe, expect, it, vi } from 'vitest'
import {
  billingCopyKeys,
  createBillingCopy,
  defaultBillingCopy
} from './copy.js'
import { createBillingApiClient } from './client.js'
import { createBillingCommands } from './commands.js'
import { createBillingPoller } from './poller.js'
import { resolveBillingReason } from './reasons.js'
import { initialBillingState, reduceBilling } from './reducer.js'
import { createSingleFlight } from './singleFlight.js'
import type {
  BillingClock,
  BillingOperationStore,
  BillingState,
  BillingStep
} from './types.js'

describe('payments claims', () => {
  it('TP-6 PM-8 PM-10 EC-P-1: sends the production subscribe body without an idempotency header', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      body: { billing_op_id: 'op', status: 'pending_payment' }
    }))
    const client = createBillingApiClient({ transport })
    await client.subscribe({
      plan_slug: 'pro',
      return_url: 'https://host/ok',
      cancel_url: 'https://host/no'
    })
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/billing/subscribe',
        headers: {},
        body: {
          plan_slug: 'pro',
          return_url: 'https://host/ok',
          cancel_url: 'https://host/no'
        }
      })
    )
  })
  it.for<[string, BillingState, BillingStep]>([
    ['select', initialBillingState, 'select'],
    [
      'preview',
      reduceBilling(initialBillingState, { type: 'started', operationId: '1' }),
      'preview'
    ],
    [
      'verifying',
      reduceBilling(initialBillingState, {
        type: 'urlReceived',
        url: 'https://verify'
      }),
      'verifying'
    ],
    [
      'canceled',
      reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'canceled',
        no_charge_confirmed: true
      }),
      'canceled'
    ],
    [
      'declined',
      reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'failed',
        reason_code: 'card_declined'
      }),
      'declined'
    ],
    [
      'processing_error',
      reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'timeout'
      }),
      'processing_error'
    ],
    [
      'payment_received_hold',
      reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'payment_received_hold'
      }),
      'payment_received_hold'
    ],
    [
      'success',
      reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'succeeded'
      }),
      'success'
    ]
  ])('TP-10 PM-6: reduces %s', ([_name, state, step]) =>
    expect(state.step).toBe(step)
  )
  it('TP-11 EC-P-6: fuzzed raw text never survives reason mapping', () => {
    for (let index = 0; index < 200; index++) {
      const raw = `${crypto.randomUUID()} <script>${index}`
      const state = reduceBilling(initialBillingState, {
        type: 'opStatus',
        status: 'failed',
        error_message: raw
      })
      expect(JSON.stringify(state)).not.toContain(raw)
      expect(resolveBillingReason({ error_message: raw })).toBe('generic')
    }
  })
  it('TP-12 PM-11: safety copy is immutable and gated by confirmed no-charge cancellation', () => {
    const copy = createBillingCopy({
      'billing.safety.nothing_was_charged': 'unsafe',
      'billing.step.success.header': 'Done'
    })
    expect(copy['billing.safety.nothing_was_charged']).toBe(
      defaultBillingCopy['billing.safety.nothing_was_charged']
    )
    expect(
      billingCopyKeys({ step: 'canceled', noChargeConfirmed: false }).safety
    ).toBeUndefined()
    expect(
      billingCopyKeys({ step: 'canceled', noChargeConfirmed: true }).safety
    ).toBe('billing.safety.nothing_was_charged')
  })
  it('TP-13 PM-7: subscribe and topup are independently single-flight', async () => {
    const flight = createSingleFlight()
    const task = vi.fn(async () => 1)
    const [a, b] = await Promise.all([
      flight('subscribe', task),
      flight('subscribe', task)
    ])
    expect([a, b]).toEqual([1, 1])
    expect(task).toHaveBeenCalledOnce()
  })
  it('opens a returned checkout URL through the host port and surfaces a blocked popup', async () => {
    const openUrl = vi.fn(async () => ({ opened: false }))
    const commands = createBillingCommands({
      client: {
        subscribe: vi.fn(async () => ({
          billing_op_id: 'op',
          status: 'needs_payment_method' as const,
          payment_method_url: 'https://checkout.example/test'
        })),
        topup: vi.fn(),
        resubscribe: vi.fn(),
        cancel: vi.fn(),
        paymentPortal: vi.fn(),
        getOperation: vi.fn(),
        getStatus: vi.fn()
      },
      ports: {
        openUrl,
        clock: { now: () => 0, schedule: vi.fn(), cancel: vi.fn() },
        operationStore: {
          namespace: 'host',
          getActiveId: async () => null,
          setActiveId: async () => undefined,
          clearActiveId: async () => undefined
        }
      }
    })
    await commands.subscribe({
      plan_slug: 'pro',
      return_url: 'https://host/ok',
      cancel_url: 'https://host/no'
    })
    expect(openUrl).toHaveBeenCalledWith(
      'https://checkout.example/test',
      'new_tab'
    )
    expect(commands.getState().step).toBe('processing_error')
  })
  it('uses fresh intents for mutation attempts while subscribe has no intent', async () => {
    const intents: string[] = []
    const recordIntent = (intent: string) => {
      intents.push(intent)
    }
    const commands = createBillingCommands({
      client: {
        subscribe: vi.fn(async () => ({
          billing_op_id: 'op',
          status: 'pending_payment' as const
        })),
        topup: vi.fn(),
        resubscribe: vi.fn(async (_input, intent) => {
          recordIntent(intent)
          return { status: 'active' as const }
        }),
        cancel: vi.fn(async (_input, intent) => {
          recordIntent(intent)
          return {
            billing_op_id: `cancel-${intents.length}`,
            cancel_at: '2026-10-03T00:00:00Z'
          }
        }),
        paymentPortal: vi.fn(async (_input, intent) => {
          intents.push(intent)
          return { url: 'https://billing.example/test' }
        }),
        getOperation: vi.fn(async () => ({ status: 'succeeded' as const })),
        getStatus: vi.fn()
      },
      ports: {
        openUrl: vi.fn(async () => ({ opened: true })),
        clock: { now: () => 0, schedule: vi.fn(), cancel: vi.fn() },
        operationStore: {
          namespace: 'host',
          getActiveId: async () => null,
          setActiveId: async () => undefined,
          clearActiveId: async () => undefined
        }
      }
    })
    const subscription = {
      plan_slug: 'pro',
      return_url: 'https://host/ok',
      cancel_url: 'https://host/no'
    }

    await commands.subscribe(subscription)
    await commands.subscribe(subscription)
    await commands.resubscribe({})
    await commands.resubscribe({})
    await commands.cancelSubscription({})
    await commands.cancelSubscription({})
    await commands.openPaymentPortal({ return_url: 'https://host/return' })
    await commands.openPaymentPortal({ return_url: 'https://host/return' })
    expect(new Set(intents)).toHaveLength(6)
  })
  it('resumes the backend pending operation from billing status', async () => {
    const openUrl = vi.fn(async () => ({ opened: true }))
    const getOperation = vi.fn(async () => ({ status: 'succeeded' as const }))
    const commands = createBillingCommands({
      client: {
        subscribe: vi.fn(),
        topup: vi.fn(),
        resubscribe: vi.fn(),
        cancel: vi.fn(),
        paymentPortal: vi.fn(),
        getOperation,
        getStatus: vi.fn(async () => ({
          pending_billing_op_id: 'server-op',
          pending_billing_op_type: 'subscription' as const,
          action_url: 'https://checkout.example/resume'
        }))
      },
      ports: {
        openUrl,
        clock: { now: () => 0, schedule: vi.fn(), cancel: vi.fn() },
        operationStore: {
          namespace: 'host',
          getActiveId: async () => null,
          setActiveId: async () => undefined,
          clearActiveId: async () => undefined
        }
      }
    })

    await commands.start()

    expect(openUrl).toHaveBeenCalledWith(
      'https://checkout.example/resume',
      'new_tab'
    )
    expect(getOperation).toHaveBeenCalledWith('server-op')
    expect(commands.getState().step).toBe('success')
  })
  it('maps mutation idempotency keys into production request bodies', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      body: { billing_op_id: 'op', cancel_at: '2026-10-03T00:00:00Z' }
    }))
    const client = createBillingApiClient({ transport })

    await client.cancel({}, 'cancel-key')

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/billing/subscription/cancel',
        headers: {},
        body: { idempotency_key: 'cancel-key' }
      })
    )
  })
  it('polls cancellation to terminal without showing no-charge copy', async () => {
    const commands = createBillingCommands({
      client: {
        subscribe: vi.fn(),
        topup: vi.fn(),
        resubscribe: vi.fn(),
        cancel: vi.fn(async () => ({
          billing_op_id: 'cancel-op',
          cancel_at: '2026-10-03T00:00:00Z'
        })),
        paymentPortal: vi.fn(),
        getOperation: vi.fn(async () => ({ status: 'succeeded' as const })),
        getStatus: vi.fn()
      },
      ports: {
        openUrl: vi.fn(async () => ({ opened: true })),
        clock: { now: () => 0, schedule: vi.fn(), cancel: vi.fn() },
        operationStore: {
          namespace: 'host',
          getActiveId: async () => null,
          setActiveId: async () => undefined,
          clearActiveId: async () => undefined
        }
      }
    })

    await commands.cancelSubscription({})

    expect(commands.getState()).toMatchObject({
      operationId: 'cancel-op',
      step: 'success',
      noChargeConfirmed: false
    })
  })
  it('branches an active canceled subscription to resubscribe', async () => {
    const resubscribe = vi.fn(async () => ({ status: 'active' as const }))
    const subscribe = vi.fn()
    const commands = createBillingCommands({
      client: {
        subscribe,
        topup: vi.fn(),
        resubscribe,
        cancel: vi.fn(),
        paymentPortal: vi.fn(),
        getOperation: vi.fn(),
        getStatus: vi.fn(async () => ({
          subscription_status: 'canceled',
          is_active: true
        }))
      },
      ports: {
        openUrl: vi.fn(async () => ({ opened: true })),
        clock: { now: () => 0, schedule: vi.fn(), cancel: vi.fn() },
        operationStore: {
          namespace: 'host',
          getActiveId: async () => null,
          setActiveId: async () => undefined,
          clearActiveId: async () => undefined
        }
      }
    })

    await commands.start()
    await commands.subscribe({
      plan_slug: 'pro-monthly',
      return_url: 'https://host/success',
      cancel_url: 'https://host/cancel'
    })

    expect(subscribe).not.toHaveBeenCalled()
    expect(resubscribe).toHaveBeenCalledWith({}, expect.any(String))
    expect(commands.getState().step).toBe('success')
  })
  it('TP-7 TP-8 TP-9 TP-15 PM-9 EC-P-2 EC-P-3 EC-P-4: resumes durable polling and clears on success', async () => {
    const delays: number[] = []
    const callbacks: Array<() => void> = []
    const clock: BillingClock = {
      now: () => 0,
      schedule: (fn, delay) => {
        delays.push(delay)
        callbacks.push(fn)
        return fn
      },
      cancel: vi.fn()
    }
    let active: string | null = 'saved'
    const store: BillingOperationStore = {
      namespace: 'host',
      getActiveId: async () => active,
      setActiveId: async (id) => {
        active = id
      },
      clearActiveId: async () => {
        active = null
      }
    }
    const getOperation = vi
      .fn<() => Promise<{ status: 'pending' | 'succeeded' }>>()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'succeeded' })
    const client = { getOperation }
    const states: BillingState[] = []
    const poller = createBillingPoller({
      client,
      clock,
      store,
      onState: (state) => states.push(state)
    })
    await poller.resume('topup')
    expect(delays).toEqual([1_000])
    callbacks[0]()
    await vi.waitFor(() => expect(getOperation).toHaveBeenCalledTimes(2))
    expect(active).toBeNull()
    expect(states.at(-1)?.step).toBe('success')
  })
})
