import {
  zAsset as zIngestAsset,
  zListAssetsResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

// Zod schemas for asset API validation matching ComfyUI Assets REST API spec
const zAsset = z.object({
  ...zIngestAsset.shape,
  created_at: z.string().datetime({ local: true }),
  hash: z.string().optional(),
  id: z.string(),
  last_access_time: z.string().datetime({ local: true }).optional(),
  preview_url: z.string().optional(),
  size: zIngestAsset.shape.size.unwrap().transform(Number).optional(),
  tags: zIngestAsset.shape.tags.default([]),
  thumbnail_url: z.string().optional(),
  updated_at: z.string().datetime({ local: true }),
  // The API sends `null` for unset metadata, which the generated `.optional()`
  // shape rejects outright; normalize it to the one absent shape consumers know.
  user_metadata: zIngestAsset.shape.user_metadata
    .nullable()
    .transform((value) => value ?? undefined)
})

const zAssetResponse = zListAssetsResponse
  .pick({ total: true, has_more: true, next_cursor: true })
  .extend({
    assets: z.array(zAsset)
  })

// Zod schema for ModelFile to align with interface
const zModelFile = z.object({
  name: z.string(),
  pathIndex: z.number()
})

const zValidationError = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string()
})

const zValidationResult = z.object({
  is_valid: z.boolean(),
  errors: z.array(zValidationError).optional(),
  warnings: z.array(zValidationError).optional()
})

const zAssetMetadata = z.object({
  content_length: z.number(),
  final_url: z.string(),
  content_type: z.string().optional(),
  filename: z.string().optional(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  preview_url: z.string().optional(),
  preview_image: z.string().optional(),
  validation: zValidationResult.optional()
})

const zAsyncUploadTask = z.object({
  task_id: z.string(),
  status: z.enum(['created', 'running', 'completed', 'failed']),
  message: z.string().optional()
})

const zAsyncUploadResponse = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sync'), asset: zAsset }),
  z.object({ type: z.literal('async'), task: zAsyncUploadTask })
])

// Filename validation schema. Trim runs FIRST so the anchored checks see the
// trimmed value — trailing-position trim let ' /etc/passwd' bypass the
// absolute-path block.
export const assetFilenameSchema = z
  .string()
  .trim()
  .min(1, 'Filename cannot be empty')
  .regex(/^[^\\:*?"<>|]+$/, 'Invalid filename characters') // Allow forward slashes, block backslashes and other unsafe chars
  .regex(/^(?!\/)/, 'Path must not be absolute')
  // Traversal check is segment-aware: `..` as a whole path segment is
  // blocked, while double dots inside a filename (`flux..v2.safetensors`)
  // stay valid.
  .refine(
    (value) => !value.split('/').includes('..'),
    'Path must not contain ".." segments'
  )

// Export schemas following repository patterns
export const assetItemSchema = zAsset
export const assetResponseSchema = zAssetResponse
export const asyncUploadResponseSchema = zAsyncUploadResponse

/**
 * Identifier for a single asset record.
 *
 * Backed by `AssetItem.id` which the API serialises as a string. This alias
 * names that primitive at use sites (services, stores, composables) without
 * changing structural typing.
 */
export type AssetId = string

// Export types derived from Zod schemas
export type AssetItem = z.infer<typeof zAsset>
export type AssetResponse = z.infer<typeof zAssetResponse>
export type AssetMetadata = z.infer<typeof zAssetMetadata>
export type AsyncUploadResponse = z.infer<typeof zAsyncUploadResponse>
export type ModelFile = z.infer<typeof zModelFile>

/** Payload for updating an asset via PUT /assets/:id */
export type AssetUpdatePayload = Partial<
  Pick<AssetItem, 'name' | 'tags' | 'user_metadata' | 'preview_id'>
>

/** User-editable metadata fields for model assets */
const zAssetUserMetadata = z.object({
  name: z.string().optional(),
  base_model: z.array(z.string()).optional(),
  additional_tags: z.array(z.string()).optional(),
  user_description: z.string().optional()
})

export type AssetUserMetadata = z.infer<typeof zAssetUserMetadata>

export const tagsOperationResultSchema = z.object({
  total_tags: z.array(z.string()),
  added: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
  already_present: z.array(z.string()).optional(),
  not_present: z.array(z.string()).optional()
})

export type TagsOperationResult = z.infer<typeof tagsOperationResultSchema>

// Legacy interface for backward compatibility (now aligned with Zod schema)
export interface ModelFolderInfo {
  name: string
  folders: string[]
  /**
   * The folder's raw registered extension allowlist from
   * `/experiment/models`. An empty array means match-all; absent on older
   * backends.
   */
  extensions?: string[]
}
