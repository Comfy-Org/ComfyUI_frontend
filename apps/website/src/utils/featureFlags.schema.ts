import { z } from 'zod'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

export const FeaturesResponseSchema = zGetFeaturesResponse

export type FeaturesResponse = z.infer<typeof FeaturesResponseSchema>
