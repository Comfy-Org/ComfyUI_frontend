import type { InjectionKey, Ref } from 'vue'

import type { MediaAssetActions } from '@/composables/useMediaAssetActions'
import type { AssetContext, AssetMeta } from '@/types/media.types'

export interface MediaAssetProviderValue {
  asset: Ref<AssetMeta | undefined>
  context: Ref<AssetContext>
  isVideoPlaying: Ref<boolean>
  actions: MediaAssetActions
}

export const mediaAssetKey: InjectionKey<MediaAssetProviderValue> =
  Symbol('mediaAsset')
