import { useSharedAssetsQuery } from '@/platform/remote/paged/assets'

export function useAssetsApi(directory: 'input' | 'output') {
  return useSharedAssetsQuery({ include_tags: [directory] })
}
