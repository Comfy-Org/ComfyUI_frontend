import { useAssetsQuery } from '@/platform/remote/lazy/assets'
/**
 * Composable for fetching media assets from cloud environment
 * Uses AssetsStore for centralized state management
 */
export function useAssetsApi(directory: 'input' | 'output') {
  //FIXME: Route this back into the store for caching
  return useAssetsQuery({ include_tags: [directory] })
}
