import { z } from 'zod'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

export const FeaturesResponseSchema = zGetFeaturesResponse.extend({
  new_free_tier_subscriptions: z.boolean()
})

export type FeaturesResponse = z.infer<typeof FeaturesResponseSchema>
