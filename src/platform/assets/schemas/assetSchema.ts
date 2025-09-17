import { z } from 'zod'

// Zod schemas for asset API validation
const zAsset = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  size: z.number(),
  created_at: z.string().optional()
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

// Export schemas following repository patterns
export const assetResponseSchema = zAssetResponse

// Export types derived from Zod schemas
export type AssetResponse = z.infer<typeof zAssetResponse>
export type ModelFolder = z.infer<typeof zModelFolder>

// Common interfaces for API responses
export interface ModelFile {
  name: string
  pathIndex: number
}

export interface ModelFolderInfo {
  name: string
  folders: string[]
}
