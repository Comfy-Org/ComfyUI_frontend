import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export interface WorkflowPublishResult {
  shareUrl: string
  publishedAt: Date
}

export interface WorkflowPublishStatus {
  isPublished: boolean
  shareUrl: string | null
  publishedAt: Date | null
  hasChangesSincePublish: boolean
}

export interface SharedWorkflowPayload {
  name: string
  description: string | null
  workflowJson: ComfyWorkflowJSON
  version: number
}
