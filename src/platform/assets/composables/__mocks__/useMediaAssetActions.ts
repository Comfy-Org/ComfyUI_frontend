import { vi } from 'vitest'

import type { useMediaAssetActions as realUseMediaAssetActions } from '../useMediaAssetActions'

type MediaAssetActions = ReturnType<typeof realUseMediaAssetActions>

const mediaAssetActions = vi.mockObject<MediaAssetActions>(
  {
    downloadAssets: () => {},
    deleteAssets: async () => false,
    copyJobId: async () => {},
    addWorkflow: async () => {},
    addMultipleToWorkflow: async () => {},
    openWorkflow: async () => {},
    openMultipleWorkflows: async () => {},
    exportWorkflow: async () => {},
    exportMultipleWorkflows: async () => {}
  },
  { spy: true }
)

export const useMediaAssetActions = vi.fn(() => mediaAssetActions)
