import { vi } from 'vitest'

import type {
  getStoredOutputIdentity as GetStoredOutputIdentity,
  resolveOutputAssetItems as ResolveOutputAssetItems
} from '@/platform/assets/utils/outputAssetUtil'

export const resolveOutputAssetItems = vi.fn<typeof ResolveOutputAssetItems>(
  async () => []
)

export const getStoredOutputIdentity = vi.fn<typeof GetStoredOutputIdentity>(
  () => undefined
)
