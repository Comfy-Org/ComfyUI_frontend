import type { AssetItem } from '@comfyorg/assets-core/schema'

export interface AssetBrowserModalProps {
  nodeType?: string
  assetType?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  title?: string
  overrideAssets?: AssetItem[]
}
