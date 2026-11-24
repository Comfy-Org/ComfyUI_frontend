import type { InjectionKey, Ref } from 'vue'

import type { AssetContext, AssetMeta } from '@comfyorg/assets-core/media'

interface MediaAssetProviderValue {
  asset: Ref<AssetMeta | undefined>
  context: Ref<AssetContext>
}

export const MediaAssetKey: InjectionKey<MediaAssetProviderValue> =
  Symbol('mediaAsset')
