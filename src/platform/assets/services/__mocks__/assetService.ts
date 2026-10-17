import { vi } from 'vitest'

import type { assetService as RealAssetService } from '../assetService'

export const assetService: Partial<typeof RealAssetService> = {
  addAssetTags: vi.fn(),
  createAssetExport: vi.fn(),
  getAllAssetsByTag: vi.fn(),
  getAssetsPageByTag: vi.fn(),
  getAssetsPageForNodeType: vi.fn(),
  getExportDownloadUrl: vi.fn(),
  removeAssetTags: vi.fn(),
  updateAsset: vi.fn()
}
