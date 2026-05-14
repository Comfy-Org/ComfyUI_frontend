/**
 * Pass as {@link AssetBrowserModal} `assetType` to load merged cloud media
 * (input, output, temp) into the browser cache. Use the model library for models.
 */
export const USER_MEDIA_ASSETS_ASSET_TYPE = '__user_media__' as const

export const USER_MEDIA_ASSETS_CACHE_CATEGORY = 'tag:__user_media__' as const

/** Tags merged by {@link updateUserMediaAssetsForLibrary} in the assets store. */
const USER_MEDIA_MERGE_TAGS = ['input', 'output', 'temp'] as const

const USER_MEDIA_MERGE_TAG_SET = new Set<string>(USER_MEDIA_MERGE_TAGS)

/**
 * TTL for skipping repeat network loads when the merged user-media cache is warm
 * and no invalidation or `force` refresh has occurred.
 */
export const USER_MEDIA_ASSETS_CACHE_MAX_AGE_MS = 60_000

export function assetTouchesUserMediaMergeTags(tags?: string[]): boolean {
  return tags?.some((t) => USER_MEDIA_MERGE_TAG_SET.has(t)) ?? false
}

function userMediaTagDeltaTouchesMerge(
  added: readonly string[],
  removed: readonly string[]
): boolean {
  return (
    added.some((t) => USER_MEDIA_MERGE_TAG_SET.has(t)) ||
    removed.some((t) => USER_MEDIA_MERGE_TAG_SET.has(t))
  )
}

export function userMediaMergedCacheNeedsRefreshAfterTagEdit(
  cacheKey: string | undefined,
  tagsToAdd: readonly string[],
  tagsToRemove: readonly string[]
): boolean {
  if (cacheKey === USER_MEDIA_ASSETS_CACHE_CATEGORY) return true
  return userMediaTagDeltaTouchesMerge(tagsToAdd, tagsToRemove)
}
