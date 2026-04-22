import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ResultItemImpl } from '@/stores/queueStore'

export interface InProgressItem {
  id: string
  jobId: string
  state: 'skeleton' | 'latent' | 'image'
  latentPreviewUrl?: string
  output?: ResultItemImpl
}

export interface OutputSelection {
  job?: JobListItem
  output?: ResultItemImpl
  canShowPreview: boolean
  latentPreviewUrl?: string
  showSkeleton?: boolean
}

export type SelectionValue =
  | { id: string; kind: 'inProgress'; itemId: string }
  | { id: string; kind: 'history'; assetId: string; key: number }
