import { z } from 'zod'

// Zod schemas for asset API validation matching ComfyUI Assets REST API spec
const zAsset = z.object({
  id: z.string(),
  name: z.string(),
  asset_hash: z.string().nullish(),
  size: z.number(),
  mime_type: z.string().nullish(),
  tags: z.array(z.string()).optional().default([]),
  preview_id: z.string().nullable().optional(),
  preview_url: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  last_access_time: z.string().optional(),
  user_metadata: z.record(z.unknown()).optional() // API allows arbitrary key-value pairs
})

const zAssetResponse = z.object({
  assets: z.array(zAsset).optional(),
  total: z.number().optional(),
  has_more: z.boolean().optional()
})

const zModelFolder = z.object({
  name: z.string(),
  folders: z.array(z.string())
})

// Zod schema for ModelFile to align with interface
const zModelFile = z.object({
  name: z.string(),
  pathIndex: z.number()
})

// Filename validation schema
export const assetFilenameSchema = z
  .string()
  .min(1, 'Filename cannot be empty')
  .regex(/^[^\\:*?"<>|]+$/, 'Invalid filename characters') // Allow forward slashes, block backslashes and other unsafe chars
  .regex(/^(?!\/|.*\.\.)/, 'Path must not start with / or contain ..') // Prevent absolute paths and directory traversal
  .trim()

// Export schemas following repository patterns
export const assetItemSchema = zAsset
export const assetResponseSchema = zAssetResponse

// Export types derived from Zod schemas
export type AssetItem = z.infer<typeof zAsset>
export type AssetResponse = z.infer<typeof zAssetResponse>
export type ModelFolder = z.infer<typeof zModelFolder>
export type ModelFile = z.infer<typeof zModelFile>

// Legacy interface for backward compatibility (now aligned with Zod schema)
export interface ModelFolderInfo {
  name: string
  folders: string[]
}
