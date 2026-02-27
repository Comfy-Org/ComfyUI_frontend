import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export interface WorkflowPublishResult {
  publishedAt: Date
  shareId: string
  shareUrl: string
}

export interface WorkflowPublishStatus {
  isPublished: boolean
  publishedAt: Date | null
  shareId: string | null
  shareUrl: string | null
}

export interface SharedWorkflowPayload {
  importedAssets: unknown[]
  listed: boolean
  publishedAt: Date | null
  shareId: string
  workflowId: string
  workflowJson: ComfyWorkflowJSON
}
