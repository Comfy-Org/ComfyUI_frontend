import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { encodeParams } from '@/utils/requestUtil'

/** Resolve a widget value to its asset: `null` when confirmed absent, `undefined` when unknown. */
export async function resolveWidgetValueAsset(
  widgetValue: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<AssetItem | null | undefined> {
  const { filepath: name } = parseAnnotatedPath(widgetValue)
  const assetMatches = (asset: AssetItem) =>
    name === asset.hash || name === (asset.loader_path ?? asset.name)
  const assetsStore = useAssetsStore()
  const storedAsset =
    toValue(assetsStore.inputAssets.items).find(assetMatches) ??
    toValue(assetsStore.outputAssets.items).find(assetMatches)
  if (storedAsset) return storedAsset

  if (!useFeatureFlags().flags.assetsEnabled) return undefined

  const lookup = async (params: Record<string, string | number>) => {
    const resp = await api.fetchApi(`/assets?${encodeParams(params)}`, {
      signal
    })
    const json = await resp.json().catch(() => {})
    const parseResult = assetResponseSchema.safeParse(json)
    return parseResult.success ? parseResult.data.assets : undefined
  }
  const byHash = await lookup({ limit: 1, hash: name })
  const hashMatch = byHash?.find(assetMatches)
  if (hashMatch) return hashMatch
  const byName = await lookup({
    name_contains: name.slice(name.lastIndexOf('/') + 1)
  })
  if (!byHash || !byName) return undefined
  return byName.find(assetMatches) ?? null
}
