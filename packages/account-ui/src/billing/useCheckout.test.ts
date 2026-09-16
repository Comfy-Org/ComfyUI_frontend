import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OPERATION_POLL_TIMING,
  PAYMENT_PORTAL_ROUTE,
  SUBSCRIBE_ROUTE,
  operationRoute
} from '@comfyorg/account/billing'

import {
  NOW,
  createBillingHarness,
  httpOk,
  opStatus,
  postedBodies,
  settle
} from './__fixtures__/billingHarness'
import { useCheckout } from './useCheckout'

const PLAN = { plan_slug: 'pro-monthly' }
const PAYMENT_PAGE = 'https://checkout.example/pay'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('useCheckout', () => {
  it('hands the hosted payment page the server offered to the host and settles the subscription', async () => {
    const { client, answer, calls } = createBillingHarness()
    answer(
      'POST',
      SUBSCRIBE_ROUTE,
      httpOk({
        billing_op_id: 'op-1',
        status: 'needs_payment_method',
        payment_method_url: PAYMENT_PAGE
      })
    )
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(opStatus({ action_url: PAYMENT_PAGE })),
      httpOk(opStatus({ status: 'succeeded' }))
    )
    const openUrl = vi.fn()

    const checkout = useCheckout({ client, openUrl })
    const result = checkout.subscribe(PLAN)
    await vi.advanceTimersByTimeAsync(0)

    expect(openUrl).toHaveBeenCalledWith(PAYMENT_PAGE, 'new_tab')
    expect(checkout.projection.value.step).toBe('verifying')
    expect(postedBodies(calls)).toEqual([
      {
        route: SUBSCRIBE_ROUTE,
        body: { plan_slug: 'pro-monthly', idempotency_key: 'key-1' }
      }
    ])

    await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)
    await expect(result).resolves.toMatchObject({
      status: 'ok',
      value: { phase: 'succeeded' }
    })
    expect(checkout.projection.value.step).toBe('success')
  })

  it('retry resends the last request after a coded decline, and the portal URL goes to the host', async () => {
    const { client, answer } = createBillingHarness()
    answer(
      'POST',
      SUBSCRIBE_ROUTE,
      httpOk({ billing_op_id: 'op-1', status: 'pending_payment' }),
      httpOk({ billing_op_id: 'op-2', status: 'subscribed' })
    )
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(
        opStatus({
          status: 'failed',
          decline_reason: 'insufficient_funds',
          error_message: 'Stripe: card_declined (insufficient_funds)'
        })
      )
    )
    answer(
      'GET',
      operationRoute('op-2'),
      httpOk(opStatus({ id: 'op-2', status: 'succeeded' }))
    )
    const openUrl = vi.fn()
    const checkout = useCheckout({ client, openUrl })

    await expect(
      checkout.retry(),
      'nothing to resend before a first request'
    ).resolves.toEqual({ status: 'error', code: 'INVALID_REQUEST' })

    await expect(settle(checkout.subscribe(PLAN))).resolves.toMatchObject({
      status: 'ok',
      value: { phase: 'failed' }
    })
    expect(checkout.projection.value).toMatchObject({
      step: 'declined',
      reasonKey: 'insufficient_funds'
    })
    expect(JSON.stringify(checkout.result.value)).not.toContain('Stripe')

    await expect(settle(checkout.retry())).resolves.toMatchObject({
      status: 'ok',
      value: { phase: 'succeeded' }
    })
    expect(checkout.projection.value).toMatchObject({
      step: 'success',
      operationId: 'op-2'
    })

    answer(
      'POST',
      PAYMENT_PORTAL_ROUTE,
      httpOk({ url: 'https://billing.example/portal' })
    )
    await expect(
      checkout.openPaymentPortal({ returnUrl: 'https://app.example/back' })
    ).resolves.toEqual({
      status: 'ok',
      value: { url: 'https://billing.example/portal' }
    })
    expect(openUrl).toHaveBeenCalledWith(
      'https://billing.example/portal',
      'new_tab'
    )
  })
})
