import type { AssetInfo } from '@/schemas/apiSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'

export interface WorkflowPublishResult {
  publishedAt: Date
  shareId: string
  shareUrl: string
}

export interface PublishPrefill {
  description?: string
  tags?: string[]
  thumbnailType?: ThumbnailType
  sampleImageUrls?: string[]
}

export type WorkflowPublishStatus =
  | {
      isPublished: false
      publishedAt: null
      shareId: null
      shareUrl: null
      prefill: null
    }
  | {
      isPublished: true
      publishedAt: Date
      shareId: string
      shareUrl: string
      prefill: PublishPrefill | null
    }

export interface SharedWorkflowPayload {
  assets: AssetInfo[]
  listed: boolean
  name: string
  publishedAt: Date | null
  shareId: string
  workflowId: string
  workflowJson: ComfyWorkflowJSON
}
