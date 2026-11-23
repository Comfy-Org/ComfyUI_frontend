import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetSubfolder } from '@/platform/assets/utils/assetUrlUtil'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { parseFilePath } from '@/utils/formatUtil'
import { encodeParams } from '@/utils/requestUtil'

function getAssetRelativePath(asset: AssetItem): string {
  if (asset.loader_path) return asset.loader_path.replaceAll('\\', '/')
  const subfolder = getAssetSubfolder(asset)
  return subfolder ? `${subfolder}/${asset.name}` : asset.name
}

/** Resolve a widget value to its asset: `null` when confirmed absent, `undefined` when unknown. */
export async function resolveWidgetValueAsset(
  widgetValue: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<AssetItem | null | undefined> {
  const { filepath, rootFolder } = parseAnnotatedPath(widgetValue)
  const { filename: hashFilename } = parseFilePath(
    /[\\/]$/.test(filepath) ? '' : filepath
  )
  const relativePath = filepath.replaceAll('\\', '/')
  const isNestedFile =
    !isCloud &&
    relativePath.includes('/') &&
    !hashFilename.startsWith('blake3:')
  const assetMatches = (asset: AssetItem) =>
    (!!asset.hash && asset.hash === hashFilename) ||
    ((!asset.hash || !!asset.loader_path) &&
      getAssetRelativePath(asset) === relativePath)
  const assetsStore = useAssetsStore()
  const inputItems = toValue(assetsStore.inputAssets.items)
  const outputItems = toValue(assetsStore.outputAssets.items)
  const [ownRootItems, otherRootItems] =
    rootFolder === 'input'
      ? [inputItems, outputItems]
      : [outputItems, inputItems]
  const storedAsset =
    ownRootItems.find(assetMatches) ??
    (isNestedFile ? undefined : otherRootItems.find(assetMatches))
  if (storedAsset) return storedAsset

  if (!useFeatureFlags().flags.assetsEnabled) return undefined
  if (!hashFilename) return null

  return resolveRemoteAsset({
    hashFilename,
    rootFolder,
    nestedMatch: isNestedFile ? assetMatches : undefined,
    signal
  })
}

async function resolveRemoteAsset({
  hashFilename,
  rootFolder,
  nestedMatch,
  signal
}: {
  hashFilename: string
  rootFolder: string
  nestedMatch?: (asset: AssetItem) => boolean
  signal?: AbortSignal
}) {
  const filters = nestedMatch
    ? {
        name_contains: hashFilename,
        tags_all: [rootFolder],
        tags_none: ['missing']
      }
    : { limit: 1, hash: hashFilename, include_public: true }
  const seenCursors = new Set<string>()
  let after: string | undefined
  while (!signal?.aborted) {
    const query = encodeParams({ ...filters, after })
    const page = await fetchAssetPage(query, signal)
    if (!page) return undefined
    const { assets, has_more, next_cursor } = page
    if (!nestedMatch) return assets[0] ?? null

    const match = assets.find(nestedMatch)
    if (match) return match
    if (!has_more) return null
    if (!next_cursor || seenCursors.has(next_cursor)) return undefined
    seenCursors.add(next_cursor)
    after = next_cursor
  }
}

async function fetchAssetPage(query: string, signal?: AbortSignal) {
  const resp = await api.fetchApi(`/assets?${query}`, { signal })
  if (!resp.ok) return undefined
  const json = await resp.json().catch(() => {})
  const parsed = assetResponseSchema.safeParse(json)
  return parsed.success && !signal?.aborted ? parsed.data : undefined
}
