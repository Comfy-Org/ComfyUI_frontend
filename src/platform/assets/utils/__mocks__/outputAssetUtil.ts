import { vi } from 'vitest'

import type { resolveOutputAssetItems as ResolveOutputAssetItems } from '../outputAssetUtil'

export const resolveOutputAssetItems = vi.fn<typeof ResolveOutputAssetItems>(
  async () => []
)
