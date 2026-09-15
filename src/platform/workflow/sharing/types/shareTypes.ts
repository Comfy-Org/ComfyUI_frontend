import type { AssetInfo } from '@/schemas/apiSchema'
import type {
  ComfyWorkflowJSON,
  WorkflowId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'

export interface WorkflowPublishResult {
  publishedAt: Date
  shareId: string
  shareUrl: string
}

export interface PublishPrefill {
  name?: string
  description?: string
  tags?: string[]
  models?: string[]
  customNodes?: string[]
  thumbnailType?: ThumbnailType
  thumbnailUrl?: string
  thumbnailComparisonUrl?: string
  sampleImageUrls?: string[]
  tutorialUrl?: string
  metadata?: Record<string, unknown>
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
  workflowId: WorkflowId
  workflowJson: ComfyWorkflowJSON
}
