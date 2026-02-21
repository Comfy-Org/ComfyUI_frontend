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
