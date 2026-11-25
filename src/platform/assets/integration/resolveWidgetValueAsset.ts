import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetResponseSchema } from '@comfyorg/assets-core/schema'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import { getAssetSubfolder } from '@comfyorg/assets-core/metadata'
import { cappedTotalParams } from '@/platform/assets/utils/cappedTotalParams'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/platform/assets/stores/assetsStore'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { parseFilePath } from '@/utils/formatUtil'
import { encodeParams } from '@comfyorg/assets-core/query'

function getAssetRelativePath(asset: AssetItem): string {
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
    !/^(?:blake3:|[a-f0-9]{64}(?:\.|$))/i.test(hashFilename)
  const matchesLegacyIdentity = (asset: AssetItem) =>
    asset.hash
      ? asset.hash === hashFilename
      : getAssetRelativePath(asset) === relativePath
  const assetMatches = (asset: AssetItem) =>
    asset.loader_path
      ? asset.loader_path.replaceAll('\\', '/') === relativePath ||
        asset.hash === hashFilename
      : matchesLegacyIdentity(asset)
  const assetsStore = useAssetsStore()
  const inputItems = toValue(assetsStore.inputAssets.items)
  const outputItems = toValue(assetsStore.outputAssets.items)
  const [ownRootItems, otherRootItems] =
    rootFolder === 'input'
      ? [inputItems, outputItems]
      : [outputItems, inputItems]
  const storedAsset =
    ownRootItems.find(assetMatches) ??
    (isNestedFile ? undefined : otherRootItems.find(matchesLegacyIdentity))
  if (storedAsset) return storedAsset

  if (!useFeatureFlags().flags.assetsEnabled) return undefined
  if (!hashFilename) return null

  const query = encodeParams({
    ...(isNestedFile
      ? {
          name_contains: hashFilename,
          tags_all: [rootFolder],
          tags_none: ['missing']
        }
      : { limit: 1, hash: hashFilename, include_public: true }),
    ...cappedTotalParams()
  })
  const page = await fetchAssetPage(query, signal)
  if (!page) return undefined
  if (!isNestedFile) return page.assets[0] ?? null
  return page.assets.find(assetMatches) ?? (page.has_more ? undefined : null)
}

async function fetchAssetPage(query: string, signal?: AbortSignal) {
  const resp = await api.fetchApi(`/assets?${query}`, { signal })
  if (!resp.ok) return undefined
  const json = await resp.json().catch(() => {})
  const parsed = assetResponseSchema.safeParse(json)
  return parsed.success && !signal?.aborted ? parsed.data : undefined
}
