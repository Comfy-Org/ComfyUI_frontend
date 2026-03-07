import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/** Common API for both cloud and internal file asset providers */
export interface IAssetsProvider {
  media: Ref<AssetItem[]>
  loading: Ref<boolean>
  error: Ref<unknown>
  fetchMediaList: () => Promise<AssetItem[]>
  refresh: () => Promise<AssetItem[]>
  loadMore: () => Promise<void>
  hasMore: Ref<boolean>
  isLoadingMore: Ref<boolean>
}
