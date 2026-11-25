import { vi } from 'vitest'

import type { assetService as RealAssetService } from '@/platform/assets/services/assetService'

export const assetService: Partial<typeof RealAssetService> = {
  addAssetTags: vi.fn(),
  createAssetExport: vi.fn(),
  getWorkspaceLibraryAssetsPage: vi.fn(),
  getAllAssetsByTag: vi.fn(),
  getAssetsPageByTag: vi.fn(),
  getAssetsPageForNodeType: vi.fn(),
  getExportDownloadUrl: vi.fn(),
  isAssetBrowserEligible: vi.fn<typeof RealAssetService.isAssetBrowserEligible>(
    () => false
  ),
  isWidgetAssetPickerEnabled: vi.fn<
    typeof RealAssetService.isWidgetAssetPickerEnabled
  >(() => false),
  removeAssetTags: vi.fn(),
  shouldUseWidgetAssetPicker: vi.fn<
    typeof RealAssetService.shouldUseWidgetAssetPicker
  >(() => false),
  updateAsset: vi.fn()
}
