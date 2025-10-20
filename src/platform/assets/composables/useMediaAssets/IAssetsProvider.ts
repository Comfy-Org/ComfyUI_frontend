import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Interface for media assets providers
 * Defines the common API for both cloud and internal file implementations
 */
export interface IAssetsProvider {
  /** Loading state indicator */
  loading: Ref<boolean>

  /** Error state, null when no error */
  error: Ref<string | null>

  /**
   * Fetch list of media assets from the specified directory
   * @param directory - 'input' or 'output'
   * @returns Promise resolving to array of AssetItem
   */
  fetchMediaList: (directory: 'input' | 'output') => Promise<AssetItem[]>
}
