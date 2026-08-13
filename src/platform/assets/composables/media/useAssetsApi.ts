import { useSharedAssetsQuery } from '@/platform/remote/paged/assets'
import { useAssetsStore } from '@/stores/assetsStore'

export function useAssetsApi(directory: 'input' | 'output') {
  if (directory === 'output') return useAssetsStore().pagedHistory
  return useSharedAssetsQuery({ include_tags: [directory] })
}
