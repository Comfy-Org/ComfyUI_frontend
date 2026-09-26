import { zChurnkeyAuthResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

export const churnkeyAuthResponseSchema = zChurnkeyAuthResponse.extend({
  customer_id: z.string().min(1),
  auth_hash: z.string().min(1)
})
