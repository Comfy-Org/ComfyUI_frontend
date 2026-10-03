import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { Ref } from 'vue'

import type { BillingOperationState } from '@comfyorg/account-core/billing'
import { TOPUP_ROUTE, operationRoute } from '@comfyorg/account-core/billing'

import {
  NOW,
  createBillingHarness,
  httpOk,
  opStatus,
  settle
} from './__fixtures__/billingHarness'
import { useBillingOperation } from './useBillingOperation'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('useBillingOperation', () => {
  it('follows the selected operation and lets go of the lifecycle with its scope', async () => {
    const { client, answer } = createBillingHarness()
    answer(
      'GET',
      operationRoute('op-1'),
      httpOk(opStatus()),
      httpOk(opStatus({ status: 'succeeded' }))
    )
    const scope = effectScope()
    let operation!: Readonly<Ref<BillingOperationState | undefined>>
    scope.run(() => {
      operation = useBillingOperation({ id: 'op-1' }, client)
    })
    expect(operation.value).toBeUndefined()

    const result = client.topup.createTopupCheckout({ amountCents: 1000 })
    await vi.advanceTimersByTimeAsync(0)
    expect(operation.value).toMatchObject({ id: 'op-1', phase: 'pending' })

    scope.stop()
    await expect(settle(result)).resolves.toMatchObject({ status: 'ok' })
    expect(
      operation.value?.phase,
      'a stopped scope must not keep receiving states'
    ).toBe('pending')
  })

  it('selecting by kind adopts the newest operation already observed and follows its replacement', async () => {
    const { client, answer } = createBillingHarness()
    await settle(client.topup.createTopupCheckout({ amountCents: 1000 }))

    const operation = useBillingOperation({ kind: 'topup' }, client)
    expect(operation.value).toMatchObject({ id: 'op-1', phase: 'succeeded' })

    answer(
      'POST',
      TOPUP_ROUTE,
      httpOk({
        amount_cents: 1000,
        billing_op_id: 'op-2',
        status: 'pending',
        topup_id: 'topup-2'
      })
    )
    answer(
      'GET',
      operationRoute('op-2'),
      httpOk(opStatus({ id: 'op-2', status: 'succeeded' }))
    )
    await settle(client.topup.createTopupCheckout({ amountCents: 1000 }))

    expect(operation.value).toMatchObject({ id: 'op-2', phase: 'succeeded' })
  })
})
