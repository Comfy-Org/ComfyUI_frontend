import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type { assetService as RealAssetService } from '../assetService'

type AssetService = typeof RealAssetService

export const assetService = fromPartial<AssetService>({
  getAllAssetsByTag: vi.fn<AssetService['getAllAssetsByTag']>(),
  getAssetsPageByTag: vi.fn<AssetService['getAssetsPageByTag']>()
})
