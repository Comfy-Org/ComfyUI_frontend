import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export interface WorkflowPublishResult {
  publishedAt: Date
  shareId: string
  shareUrl: string
}

export type WorkflowPublishStatus =
  | { isPublished: false; publishedAt: null; shareId: null; shareUrl: null }
  | {
      isPublished: true
      publishedAt: Date
      shareId: string
      shareUrl: string
    }

export interface SharedWorkflowPayload {
  importedAssets: unknown[]
  listed: boolean
  publishedAt: Date | null
  shareId: string
  workflowId: string
  workflowJson: ComfyWorkflowJSON
}
