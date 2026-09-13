import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type * as AssetServiceModule from '../assetService'
import type { assetService as RealAssetService } from '../assetService'

type AssetService = typeof RealAssetService

const assetServiceModule = {
  assetService: fromPartial<AssetService>({
    addAssetTags: vi.fn<AssetService['addAssetTags']>(),
    getAllAssetsByTag: vi.fn<AssetService['getAllAssetsByTag']>(),
    getAssetsPageByTag: vi.fn<AssetService['getAssetsPageByTag']>(),
    getAssetsPageForNodeType: vi.fn<AssetService['getAssetsPageForNodeType']>(),
    removeAssetTags: vi.fn<AssetService['removeAssetTags']>(),
    updateAsset: vi.fn<AssetService['updateAsset']>()
  }),
  MODELS_TAG: 'models',
  MISSING_TAG: 'missing'
} satisfies typeof AssetServiceModule

export const { assetService, MODELS_TAG, MISSING_TAG } = assetServiceModule
