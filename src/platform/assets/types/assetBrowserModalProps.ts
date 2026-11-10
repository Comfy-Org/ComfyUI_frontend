import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

export interface AssetBrowserModalProps {
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  overrideAssets?: AssetItem[]
}
