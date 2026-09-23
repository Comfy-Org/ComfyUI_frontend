import { vi } from 'vitest'

import type { useWorkflowShareService as realUseWorkflowShareService } from '../workflowShareService'

type WorkflowShareService = ReturnType<typeof realUseWorkflowShareService>

const workflowShareService = vi.mockObject<WorkflowShareService>(
  {
    publishWorkflow: () =>
      Promise.reject(new Error('publishWorkflow is not configured')),
    getPublishStatus: async () => ({
      isPublished: false,
      shareId: null,
      shareUrl: null,
      publishedAt: null,
      prefill: null
    }),
    getShareableAssets: async () => [],
    getSharedWorkflow: () =>
      Promise.reject(new Error('getSharedWorkflow is not configured')),
    importPublishedAssets: async () => {}
  },
  { spy: true }
)

export const useWorkflowShareService = vi.fn(() => workflowShareService)
