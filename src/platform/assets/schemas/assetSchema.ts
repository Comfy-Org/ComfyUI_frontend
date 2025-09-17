import { z } from 'zod'

// Zod schemas for asset API validation matching ComfyUI Assets REST API spec
const zAsset = z.object({
  id: z.string(),
  name: z.string(),
  asset_hash: z.string().nullable(),
  size: z.number(),
  mime_type: z.string().nullable(),
  tags: z.array(z.string()),
  preview_url: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  last_access_time: z.string(),
  user_metadata: z.record(z.unknown()).optional(), // API allows arbitrary key-value pairs
  preview_id: z.string().nullable().optional()
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

// Export schemas following repository patterns
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
