import { vi } from 'vitest'

import type { resolveOutputAssetItems as ResolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'

export const resolveOutputAssetItems = vi.fn<typeof ResolveOutputAssetItems>(
  async () => []
)
