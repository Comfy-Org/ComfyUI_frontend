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
  it('TP-6 PM-8 PM-10 EC-P-1: routes subscribe through the transport with an idempotency header', async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      body: { billing_op_id: 'op' }
    }))
    const client = createBillingApiClient({ transport })
    await client.subscribe(
      {
        plan_slug: 'pro',
        return_url: 'https://host/ok',
        cancel_url: 'https://host/no'
      },
      'intent-1'
    )
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/billing/subscribe',
        headers: { 'Idempotency-Key': 'intent-1' }
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
  ])('TP-10 PM-6: reduces %s', (_name, state, step) =>
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
          action_url: 'https://checkout.example/test'
        })),
        topup: vi.fn(),
        resubscribe: vi.fn(),
        cancel: vi.fn(),
        paymentPortal: vi.fn(),
        getOperation: vi.fn()
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
  it('uses a fresh intent for each billing attempt and preserves explicit resume intents', async () => {
    const intents: string[] = []
    const recordIntent = (intent: string) => {
      intents.push(intent)
      return Promise.resolve({ status: 'succeeded' as const })
    }
    const commands = createBillingCommands({
      client: {
        subscribe: vi.fn(async (_input, intent) => {
          intents.push(intent)
          return { billing_op_id: 'op' }
        }),
        topup: vi.fn(),
        resubscribe: vi.fn((_input, intent) => recordIntent(intent)),
        cancel: vi.fn((_input, intent) => recordIntent(intent)),
        paymentPortal: vi.fn(async (_input, intent) => {
          intents.push(intent)
          return { url: 'https://billing.example/test' }
        }),
        getOperation: vi.fn(async () => ({ status: 'succeeded' }))
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
    await commands.resubscribe({ plan_slug: 'pro' })
    await commands.resubscribe({ plan_slug: 'pro' })
    await commands.cancelSubscription({})
    await commands.cancelSubscription({})
    await commands.openPaymentPortal({ return_url: 'https://host/return' })
    await commands.openPaymentPortal({ return_url: 'https://host/return' })
    await commands.subscribe(subscription, 'resume-intent')

    expect(new Set(intents.slice(0, 8))).toHaveLength(8)
    expect(intents.at(-1)).toBe('resume-intent')
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
