import { vi } from 'vitest'
import type { useWorkflowShareService as realUseWorkflowShareService } from '../workflowShareService'

type WorkflowShareService = ReturnType<typeof realUseWorkflowShareService>

const workflowShareService: WorkflowShareService = {
  publishWorkflow: vi.fn<WorkflowShareService['publishWorkflow']>(() =>
    Promise.reject(new Error('publishWorkflow is not configured'))
  ),
  getPublishStatus: vi.fn<WorkflowShareService['getPublishStatus']>(
    async () => ({
      isPublished: false,
      shareId: null,
      shareUrl: null,
      publishedAt: null,
      prefill: null
    })
  ),
  getShareableAssets: vi.fn<WorkflowShareService['getShareableAssets']>(
    async () => []
  ),
  getSharedWorkflow: vi.fn<WorkflowShareService['getSharedWorkflow']>(() =>
    Promise.reject(new Error('getSharedWorkflow is not configured'))
  ),
  importPublishedAssets: vi.fn<WorkflowShareService['importPublishedAssets']>(
    async () => {}
  )
}

export const useWorkflowShareService = vi.fn(() => workflowShareService)
