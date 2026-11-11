import type { MediaType } from '@comfyorg/shared-frontend-utils/formatUtil'
import {
  MEDIA_TYPES,
  getMediaTypeFromFilename
} from '@comfyorg/shared-frontend-utils/formatUtil'
import { sortBy } from 'es-toolkit'
import { z } from 'zod'

import { getAssetDisplayName } from './metadata'
import type { AssetItem } from './schema'
import { assetItemSchema } from './schema'

export const zMediaKindSchema = z.enum(MEDIA_TYPES)
export type MediaKind = MediaType

export const zDimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
})

export const zMediaAssetDisplayItemSchema = assetItemSchema.extend({
  kind: zMediaKindSchema,
  src: z.url(),
  duration: z.number().nonnegative().optional(),
  dimensions: zDimensionsSchema.optional()
})

export const zAssetContextSchema = z.object({
  type: z.enum(['input', 'output']),
  outputCount: z.number().positive().optional()
})

export type AssetMeta = z.infer<typeof zMediaAssetDisplayItemSchema>
export type AssetContext = z.infer<typeof zAssetContextSchema>

export type MediaAssetDateFilter = '' | 'today' | 'week' | 'month' | 'year'
export type MediaAssetSortOption =
  | 'newest'
  | 'oldest'
  | 'az'
  | 'za'
  | 'longest'
  | 'fastest'

export function getAssetTime(asset: AssetItem): number {
  const createTime = asset.user_metadata?.create_time
  return typeof createTime === 'number'
    ? createTime
    : asset.created_at
      ? new Date(asset.created_at).getTime()
      : 0
}

export function getAssetExecutionTime(asset: AssetItem): number {
  const executionTime = asset.user_metadata?.executionTimeInSeconds
  return typeof executionTime === 'number' ? executionTime : 0
}

export function getDateThreshold(
  filter: MediaAssetDateFilter,
  now: number
): number | null {
  switch (filter) {
    case 'today': {
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      return startOfToday.getTime()
    }
    case 'week':
      return now - 7 * 86_400_000
    case 'month':
      return now - 30 * 86_400_000
    case 'year':
      return new Date(new Date(now).getFullYear(), 0, 1).getTime()
    default:
      return null
  }
}

export function compareAssetNames(a: AssetItem, b: AssetItem): number {
  return getAssetDisplayName(a).localeCompare(
    getAssetDisplayName(b),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  )
}

export function filterMediaAssets<T extends AssetItem>(
  assets: readonly T[],
  mediaTypeFilters: readonly string[],
  dateFilter: MediaAssetDateFilter,
  now: number
): T[] {
  const threshold = getDateThreshold(dateFilter, now)
  return assets.filter((asset) => {
    const matchesMediaType =
      mediaTypeFilters.length === 0 ||
      mediaTypeFilters.includes(
        getMediaTypeFromFilename(asset.name).toLowerCase()
      )
    const matchesDate = threshold === null || getAssetTime(asset) >= threshold
    return matchesMediaType && matchesDate
  })
}

export function sortMediaAssets<T extends AssetItem>(
  assets: readonly T[],
  option: MediaAssetSortOption
): T[] {
  switch (option) {
    case 'oldest':
      return sortBy(assets, [getAssetTime])
    case 'longest':
      return sortBy(assets, [(asset) => -getAssetExecutionTime(asset)])
    case 'fastest':
      return sortBy(assets, [getAssetExecutionTime])
    case 'az':
      return [...assets].sort(compareAssetNames)
    case 'za':
      return [...assets].sort((a, b) => compareAssetNames(b, a))
    case 'newest':
    default:
      return sortBy(assets, [(asset) => -getAssetTime(asset)])
  }
}
