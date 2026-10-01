import type {
  HostedBillingIntent,
  PaymentIntentSource
} from '@comfyorg/account-core/billing'
import { describe, expectTypeOf, it } from 'vitest'

import type { BillingIntent, BillingSource } from './contract.js'

describe('the billing event vocabulary', () => {
  it('names the same sources as the entry URL contract', () => {
    expectTypeOf<PaymentIntentSource>().toEqualTypeOf<BillingSource>()
  })

  it('names the same intents as the entry URL contract', () => {
    expectTypeOf<HostedBillingIntent>().toEqualTypeOf<BillingIntent>()
  })
})
