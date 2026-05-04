import { QueryClient } from '@tanstack/vue-query'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const queryClient = new QueryClient()
const inputAssetsIncludingPublicQueryPrefix = ['assets', 'input'] as const
let inputAssetsIncludingPublicGeneration = 0

export function invalidateInputAssetsIncludingPublicQuery(): void {
  inputAssetsIncludingPublicGeneration++
  void queryClient.invalidateQueries({
    queryKey: inputAssetsIncludingPublicQueryPrefix,
    refetchType: 'none'
  })
}

export async function fetchInputAssetsIncludingPublicQuery(
  fetchAssets: () => Promise<AssetItem[]>
): Promise<AssetItem[]> {
  return await queryClient.fetchQuery({
    queryKey: [
      ...inputAssetsIncludingPublicQueryPrefix,
      { includePublic: true, generation: inputAssetsIncludingPublicGeneration }
    ],
    queryFn: fetchAssets,
    retry: false,
    staleTime: Infinity
  })
}
