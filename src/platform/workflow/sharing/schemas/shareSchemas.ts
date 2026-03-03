import { z } from 'zod'

import { zAssetInfo, zComfyHubProfile } from '@/schemas/apiSchema'

export const zPublishRecordResponse = z.object({
  workflow_id: z.string(),
  share_id: z.string(),
  listed: z.boolean(),
  publish_time: z.string().nullable(),
  assets: z.array(zAssetInfo)
})

export const zSharedWorkflowResponse = z.object({
  share_id: z.string(),
  workflow_id: z.string(),
  name: z.string(),
  listed: z.boolean(),
  publish_time: z.string().nullable(),
  workflow_json: z.record(z.string(), z.unknown()),
  assets: z.array(zAssetInfo)
})

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
