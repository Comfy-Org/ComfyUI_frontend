import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { parseFilePath } from '@/utils/formatUtil'
import { encodeParams } from '@/utils/requestUtil'

/** Resolve a widget value to its asset: `null` when confirmed absent, `undefined` when unknown. */
export async function resolveWidgetValueAsset(
  widgetValue: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<AssetItem | null | undefined> {
  const { filepath } = parseAnnotatedPath(widgetValue)
  const { filename: hashFilename } = parseFilePath(
    /[\\/]$/.test(filepath) ? '' : filepath
  )
  const assetMatches = (asset: AssetItem) =>
    asset.hash ? asset.hash === hashFilename : asset.name === filepath
  const assetsStore = useAssetsStore()
  const storedAsset =
    toValue(assetsStore.inputAssets.items).find(assetMatches) ??
    toValue(assetsStore.outputAssets.items).find(assetMatches)
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
