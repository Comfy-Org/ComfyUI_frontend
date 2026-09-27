import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

export interface AssetBrowserModalProps {
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  /**
   * Storybook/test seam: when provided, bypasses the cloud-only
   * `assetsStore.getAssets(cacheKey)` fetch and renders this list directly.
   * Production callers should leave this undefined and rely on the store.
   */
  overrideAssets?: AssetItem[]
}
