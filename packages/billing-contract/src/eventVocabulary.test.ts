import type {
  HostedBillingIntent,
  PaymentIntentSource,
  WebEntryBounceTarget,
  WebEntryErrorCode,
  WebEntryProduct
} from '@comfyorg/account-core/billing'
import { describe, expectTypeOf, it } from 'vitest'

import type {
  BillingIntent,
  BillingProduct,
  BillingSource
} from './contract.js'
import type { BillingEntryErrorCode } from './entryParser.js'
import type { ReturnTarget } from './returnTargets.js'

describe('the billing event vocabulary', () => {
  it('names the same sources as the entry URL contract', () => {
    expectTypeOf<PaymentIntentSource>().toEqualTypeOf<BillingSource>()
  })

  it('names the same intents as the entry URL contract', () => {
    expectTypeOf<HostedBillingIntent>().toEqualTypeOf<BillingIntent>()
  })

  it('names the same products as the entry URL contract', () => {
    expectTypeOf<WebEntryProduct>().toEqualTypeOf<BillingProduct>()
  })

  it('names the same entry errors as the entry parser', () => {
    expectTypeOf<WebEntryErrorCode>().toEqualTypeOf<BillingEntryErrorCode>()
  })

  it('names the return targets a bounced entry can go to, and the pricing table', () => {
    expectTypeOf<WebEntryBounceTarget>().toEqualTypeOf<
      ReturnTarget | 'pricing_table'
    >()
  })
})
