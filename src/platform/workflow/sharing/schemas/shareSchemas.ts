import { z } from 'zod'

import { zComfyHubProfile } from '@/schemas/apiSchema'
import type { KeysToCamelCase } from '@/types/caseConversion'

export const zPublishRecordResponse = z.object({
  workflow_id: z.string().optional(),
  share_id: z.string().nullish(),
  listed: z.boolean().optional(),
  publish_time: z.string().nullish()
})

export type PublishRecordResponse = KeysToCamelCase<
  z.infer<typeof zPublishRecordResponse>
>

export const zSharedWorkflowResponse = z.object({
  share_id: z.string(),
  workflow_id: z.string(),
  listed: z.boolean(),
  publish_time: z.string().optional(),
  workflow_json: z.record(z.string(), z.unknown()),
  imported_assets: z.array(z.unknown()).optional()
})

export type SharedWorkflowResponse = KeysToCamelCase<
  z.infer<typeof zSharedWorkflowResponse>
>

export const zHubProfileResponse = z.preprocess((data) => {
  if (!data || typeof data !== 'object') return data
  const d = data as Record<string, unknown>
  return {
    username: d.username,
    name: d.name,
    description: d.description,
    coverImageUrl: d.coverImageUrl ?? d.cover_image_url,
    profilePictureUrl: d.profilePictureUrl ?? d.profile_picture_url
  }
}, zComfyHubProfile)
