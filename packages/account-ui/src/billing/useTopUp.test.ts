import {
  OPERATION_POLL_TIMING,
  TOPUP_ROUTE,
  operationRoute
} from '@comfyorg/account-core/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CAPABILITIES,
  NOW,
  createBillingHarness,
  httpOk,
  opStatus,
  postedBodies,
  settle
} from './__fixtures__/billingHarness'
import { useTopUp } from './useTopUp'

const HOSTED_PAGE = 'https://checkout.example/pay'

function secondTopup() {
  return httpOk({
    amount_cents: 1000,
    billing_op_id: 'op-2',
    status: 'pending',
    topup_id: 'topup-2'
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('useTopUp', () => {
  it('exposes the server verdict on can_top_up with its coded denial, and a refused submit sends nothing', async () => {
    const { client, routes } = createBillingHarness({
      capabilities: {
        capabilities: { ...CAPABILITIES, can_top_up: false },
        denied_reasons: { can_top_up: 'tier_not_self_serve' }
      }
    })

    const topUp = useTopUp({ client, openUrl: vi.fn() })
    expect(
      topUp.canTopUp.value,
      'unknown until the server has answered; never derived locally'
    ).toBeUndefined()
    await vi.advanceTimersByTimeAsync(0)
    expect(topUp.canTopUp.value).toBe(false)
    expect(topUp.denial.value).toBe('tier_not_self_serve')

    await expect(settle(topUp.submit())).resolves.toEqual({
      status: 'error',
      code: 'ACCESS_DENIED',
      denial: 'tier_not_self_serve'
    })
    expect(routes().filter((route) => route.startsWith('POST'))).toEqual([])
    expect(topUp.projection.value.step).toBe('select')
  })

  it('keeps presets, bounds, and the credit rate on the host side: an amount under the host floor never reaches the core', async () => {
    const { client, calls, routes } = createBillingHarness()

    const topUp = useTopUp({
      client,
      openUrl: vi.fn(),
      presetsCents: [2000, 4000],
      minAmountCents: 2000,
      maxAmountCents: 8000,
      creditsPerDollar: 211
    })
    expect(topUp.presetsCents).toEqual([2000, 4000])
    expect(topUp.amountCents.value).toBe(2000)
    expect(topUp.credits.value).toBe(4220)

    topUp.amountCents.value = 1000
    expect(
      topUp.amountValid.value,
      'above the contract floor of 500 cents, below the host floor'
    ).toBe(false)
    await expect(topUp.submit()).resolves.toEqual({
      status: 'error',
      code: 'INVALID_AMOUNT'
    })
    expect(routes()).not.toContain(`POST ${TOPUP_ROUTE}`)

    topUp.amountCents.value = 4000
    await expect(settle(topUp.submit())).resolves.toMatchObject({
      status: 'ok'
    })
    expect(postedBodies(calls)).toEqual([
      {
        route: TOPUP_ROUTE,
        body: { amount_cents: 4000, idempotency_key: 'key-1' }
      }
    ])
  })

  it('hands a hosted continuation to the host once, in the configured mode, and again on continueVerification', async () => {
    const { client, answer } = createBillingHarness()
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(opStatus({ action_url: HOSTED_PAGE })),
      httpOk(opStatus({ status: 'succeeded' }))
    )
    const openUrl = vi.fn()

    const topUp = useTopUp({ client, openUrl, navigationMode: 'preopened' })
    topUp.preview()
    const result = topUp.submit()
    await vi.advanceTimersByTimeAsync(0)

    expect(topUp.submitting.value).toBe(true)
    expect(topUp.projection.value).toMatchObject({
      step: 'verifying',
      operationId: 'op-1'
    })
    expect(openUrl).toHaveBeenCalledTimes(1)
    expect(openUrl).toHaveBeenCalledWith(HOSTED_PAGE, 'preopened')

    topUp.continueVerification()
    expect(openUrl).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)
    await expect(result).resolves.toMatchObject({
      status: 'ok',
      creditsReconciled: true
    })
    expect(topUp.projection.value.step).toBe('success')
    expect(topUp.submitting.value).toBe(false)
  })

  it('drives an embedded challenge through the host port, never a URL, and re-reads the verdict after settlement', async () => {
    const { client, answer, routes } = createBillingHarness({ embedded: true })
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(
        opStatus({
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret'
        })
      ),
      httpOk(opStatus({ status: 'succeeded' }))
    )
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'processing' }
    }))
    const openUrl = vi.fn()

    const topUp = useTopUp({
      client,
      openUrl,
      challengePort: { handleNextAction }
    })
    await vi.advanceTimersByTimeAsync(0)
    const capabilityReads = () =>
      routes().filter((route) => route === 'GET /billing/capabilities').length
    expect(capabilityReads()).toBe(1)

    const result = topUp.submit()
    await vi.advanceTimersByTimeAsync(0)
    expect(handleNextAction).toHaveBeenCalledWith('pi_secret')
    expect(openUrl).not.toHaveBeenCalled()

    await expect(settle(result)).resolves.toMatchObject({ status: 'ok' })
    expect(topUp.projection.value.step).toBe('success')
    expect(
      capabilityReads(),
      'the core invalidated its snapshot; the verdict on screen follows the server'
    ).toBe(2)
  })

  it('projects a decline by its coded reason without the provider text, and retry starts a fresh attempt', async () => {
    const { client, answer } = createBillingHarness()
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(
        opStatus({
          status: 'failed',
          decline_reason: 'card_declined',
          recovery_action: 'replace_payment_method',
          retryable: true,
          error_message: 'Your card was declined by Stripe.'
        })
      )
    )

    const topUp = useTopUp({ client, openUrl: vi.fn() })
    await expect(settle(topUp.submit())).resolves.toMatchObject({
      status: 'declined'
    })
    expect(topUp.projection.value).toEqual({
      step: 'declined',
      reasonKey: 'card_declined',
      recoveryAction: 'replace_payment_method',
      operationId: 'op-1',
      noChargeConfirmed: false
    })
    expect(
      JSON.stringify({
        result: topUp.result.value,
        projection: topUp.projection.value,
        operation: topUp.operation.value
      })
    ).not.toContain('Stripe')

    answer('POST', TOPUP_ROUTE, secondTopup())
    answer(
      'GET',
      operationRoute('op-2'),
      httpOk(opStatus({ id: 'op-2', status: 'succeeded' }))
    )
    await expect(settle(topUp.retry())).resolves.toMatchObject({
      status: 'ok'
    })
    expect(topUp.projection.value).toMatchObject({
      step: 'success',
      operationId: 'op-2'
    })
  })

  it('lets a host-reported cancel outrank a live operation, and reset drop only a settled one', async () => {
    const { client, answer } = createBillingHarness()
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(opStatus({ action_url: HOSTED_PAGE })),
      httpOk(opStatus({ status: 'succeeded' }))
    )

    const topUp = useTopUp({ client, openUrl: vi.fn() })
    const result = topUp.submit()
    await vi.advanceTimersByTimeAsync(0)
    expect(topUp.projection.value.step).toBe('verifying')

    topUp.cancel()
    expect(topUp.projection.value).toMatchObject({
      step: 'canceled',
      operationId: 'op-1'
    })

    topUp.reset()
    expect(
      topUp.projection.value.step,
      'a live operation is never dropped from view; the server may still settle it'
    ).toBe('verifying')

    await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)
    await result
    expect(topUp.projection.value.step).toBe('success')

    topUp.reset()
    expect(topUp.projection.value).toEqual({
      step: 'select',
      noChargeConfirmed: false
    })
  })
})
