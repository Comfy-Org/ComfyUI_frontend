import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AugmentedResultItem } from '@/stores/resultItem'

export interface InProgressItem {
  id: string
  jobId: string
  state: 'skeleton' | 'latent' | 'image'
  latentPreviewUrl?: string
  output?: AugmentedResultItem
}

export interface OutputSelection {
  asset?: AssetItem
  output?: AugmentedResultItem
  canShowPreview: boolean
  latentPreviewUrl?: string
  showSkeleton?: boolean
}

export type SelectionValue =
  | { id: string; kind: 'inProgress'; itemId: string }
  | { id: string; kind: 'history'; assetId: string; key: number }
