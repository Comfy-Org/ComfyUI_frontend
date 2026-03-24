import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { ResolveOutputAssetItemsOptions } from '@/platform/assets/utils/outputAssetUtil'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'

/**
 * Resolve all output assets for a given asset.
 * Cloud: uses Assets API via fetchPromptAssets.
 * OSS: uses Jobs API via resolveOutputAssetItems.
 */
export async function resolveAssetOutputs(
  asset: AssetItem,
  options?: ResolveOutputAssetItemsOptions & { excludeParent?: boolean }
): Promise<AssetItem[]> {
  if (asset.prompt_id) {
    const all = await assetService.fetchPromptAssets(asset.prompt_id)
    return options?.excludeParent ? all.filter((a) => a.id !== asset.id) : all
  }

  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata) return []
  return resolveOutputAssetItems(metadata, options)
}
