import { zSubscriptionDiscount } from '@comfyorg/ingest-types/zod'

import { wireCents } from './wireCents'

export const SubscriptionDiscountSchema = zSubscriptionDiscount.extend({
  amount_off_cents: wireCents.optional(),
  duration_in_months: wireCents.optional()
})
