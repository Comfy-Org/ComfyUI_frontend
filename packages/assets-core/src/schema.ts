import {
  zAsset as zIngestAsset,
  zListAssetsResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

const zAsset = z.object({
  ...zIngestAsset.shape,
  created_at: z.iso.datetime({ local: true }),
  hash: z.string().optional(),
  id: z.string(),
  last_access_time: z.iso.datetime({ local: true }).optional(),
  preview_url: z.string().optional(),
  size: zIngestAsset.shape.size.unwrap().transform(Number).optional(),
  tags: zIngestAsset.shape.tags.default([]),
  thumbnail_url: z.string().optional(),
  updated_at: z.iso.datetime({ local: true }),
  user_metadata: zIngestAsset.shape.user_metadata
    .nullable()
    .transform((value) => value ?? undefined)
    .optional()
})
const zAssetResponse = zListAssetsResponse
  .pick({ total: true, has_more: true, next_cursor: true })
  .extend({
    assets: z.array(zAsset)
  })
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
export const assetFilenameSchema = z
  .string()
  .trim()
  .min(1, 'Filename cannot be empty')
  .regex(/^[^\\:*?"<>|]+$/, 'Invalid filename characters')
  .regex(/^(?!\/)/, 'Path must not be absolute')
  .refine(
    (value) => !value.split('/').includes('..'),
    'Path must not contain ".." segments'
  )
export const assetItemSchema = zAsset
export const assetResponseSchema = zAssetResponse
export const asyncUploadResponseSchema = zAsyncUploadResponse
export type AssetId = string
export type AssetItem = z.infer<typeof zAsset>
export type ModelBrowserAsset = AssetItem & {
  isWorkspaceLibrary?: boolean
  browserCategories?: string[]
}
export type AssetResponse = z.infer<typeof zAssetResponse>
export type AssetMetadata = z.infer<typeof zAssetMetadata>
export type AsyncUploadResponse = z.infer<typeof zAsyncUploadResponse>
export type ModelFile = z.infer<typeof zModelFile>
export type AssetUpdatePayload = Partial<
  Pick<AssetItem, 'name' | 'tags' | 'user_metadata' | 'preview_id'>
>
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
