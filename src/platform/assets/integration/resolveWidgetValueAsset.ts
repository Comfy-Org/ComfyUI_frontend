import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetResponseSchema } from '@comfyorg/assets-core/schema'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import { getAssetSubfolder } from '@comfyorg/assets-core/metadata'
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
  const assetMatches = (asset: AssetItem) =>
    asset.hash
      ? asset.hash === hashFilename
      : getAssetRelativePath(asset) === relativePath
  const assetsStore = useAssetsStore()
  const inputItems = toValue(assetsStore.inputAssets.items)
  const outputItems = toValue(assetsStore.outputAssets.items)
  const [ownRootItems, otherRootItems] =
    rootFolder === 'input'
      ? [inputItems, outputItems]
      : [outputItems, inputItems]
  const storedAsset =
    ownRootItems.find(assetMatches) ?? otherRootItems.find(assetMatches)
  if (storedAsset) return storedAsset

  if (!useFeatureFlags().flags.assetsEnabled) return undefined
  if (!hashFilename) return null

  const query = encodeParams({
    limit: 1,
    hash: hashFilename,
    include_public: true
  })
  const resp = await api.fetchApi(`/assets?${query}`, { signal })
  const json = await resp.json().catch(() => {})
  const parseResult = assetResponseSchema.safeParse(json)
  return parseResult.success ? (parseResult.data.assets[0] ?? null) : undefined
}
