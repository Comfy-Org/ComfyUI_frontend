import { zHubWorkflowDetail, zLabelRef } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { zAssetInfo, zComfyHubProfile } from '@/schemas/apiSchema'

export const zPublishRecordResponse = z.object({
  workflow_id: z.string(),
  share_id: z.string().nullable(),
  listed: z.boolean(),
  publish_time: z.string().nullable(),
  assets: z.array(zAssetInfo).optional()
})

const zPrefillTag = zLabelRef
  .transform((label) => label.display_name)
  .or(z.string())

const zPrefillTagList = z
  .array(zPrefillTag.optional().catch(undefined))
  .transform((tags) => tags.filter((tag): tag is string => tag !== undefined))

function omitNullFields(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null)
  )
}

/**
 * Prefill is best-effort, so it validates only the fields the publish dialog
 * reads: gating on the rest of `zHubWorkflowDetail` would discard every field
 * whenever `workflow_json`, `assets`, `profile`, or `publish_time` drift.
 */
export const zHubWorkflowPrefillResponse = z.preprocess(
  omitNullFields,
  zHubWorkflowDetail
    .pick({
      name: true,
      description: true,
      thumbnail_url: true,
      thumbnail_comparison_url: true
    })
    .partial()
    .extend({
      tags: zPrefillTagList.optional().catch(undefined),
      thumbnail_type: zHubWorkflowDetail.shape.thumbnail_type.catch(undefined),
      sample_image_urls:
        zHubWorkflowDetail.shape.sample_image_urls.catch(undefined)
    })
)

export type HubWorkflowPrefillResponse = z.infer<
  typeof zHubWorkflowPrefillResponse
>

/**
 * Strips path separators and control characters from a workflow name to prevent
 * path traversal when the name is later used as part of a file path.
 */
function sanitizeWorkflowName(name: string): string {
  return name
    .replaceAll(/[/\\:]/g, '_')
    .slice(0, 200)
    .trim()
}

export const zSharedWorkflowResponse = z.object({
  share_id: z.string(),
  workflow_id: z.string(),
  name: z.string().transform(sanitizeWorkflowName),
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
    name: d.name ?? d.display_name,
    description: d.description,
    coverImageUrl: d.coverImageUrl ?? d.cover_image_url,
    profilePictureUrl:
      d.profilePictureUrl ?? d.profile_picture_url ?? d.avatar_url
  }
}, zComfyHubProfile)

export const zHubAssetUploadUrlResponse = z
  .object({
    upload_url: z.string(),
    public_url: z.string(),
    token: z.string()
  })
  .transform((response) => ({
    uploadUrl: response.upload_url,
    publicUrl: response.public_url,
    token: response.token
  }))

export const zHubWorkflowPublishResponse = z.object({
  share_id: z.string(),
  workflow_id: z.string(),
  thumbnail_type: z.enum(['image', 'video', 'image_comparison']).optional()
})

const zHubLabelInfo = z.object({
  name: z.string(),
  display_name: z.string(),
  type: z.enum(['tag', 'model', 'custom_node'])
})

export const zHubLabelListResponse = z.object({
  labels: z.array(zHubLabelInfo)
})
