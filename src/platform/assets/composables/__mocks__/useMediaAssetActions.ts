import { vi } from 'vitest'
import type { useMediaAssetActions as realUseMediaAssetActions } from '../useMediaAssetActions'

type MediaAssetActions = ReturnType<typeof realUseMediaAssetActions>

const mediaAssetActions: MediaAssetActions = {
  downloadAssets: vi.fn<MediaAssetActions['downloadAssets']>(() => {}),
  deleteAssets: vi.fn<MediaAssetActions['deleteAssets']>(async () => false),
  copyJobId: vi.fn<MediaAssetActions['copyJobId']>(async () => {}),
  addWorkflow: vi.fn<MediaAssetActions['addWorkflow']>(async () => {}),
  addMultipleToWorkflow: vi.fn<MediaAssetActions['addMultipleToWorkflow']>(
    async () => {}
  ),
  openWorkflow: vi.fn<MediaAssetActions['openWorkflow']>(async () => {}),
  openMultipleWorkflows: vi.fn<MediaAssetActions['openMultipleWorkflows']>(
    async () => {}
  ),
  exportWorkflow: vi.fn<MediaAssetActions['exportWorkflow']>(async () => {}),
  exportMultipleWorkflows: vi.fn<MediaAssetActions['exportMultipleWorkflows']>(
    async () => {}
  )
}

export const useMediaAssetActions = vi.fn(() => mediaAssetActions)
