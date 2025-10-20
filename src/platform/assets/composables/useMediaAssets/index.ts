import { isCloud } from '@/platform/distribution/types'

import type { IAssetsProvider } from './IAssetsProvider'
import { useAssetsApi } from './useAssetsApi'
import { useInternalFilesApi } from './useInternalFilesApi'

/**
 * Factory function that returns the appropriate media assets implementation
 * based on the current distribution (cloud vs internal)
 * @returns IAssetsProvider implementation
 */
export function useMediaAssets(): IAssetsProvider {
  return isCloud ? useAssetsApi() : useInternalFilesApi()
}

// Re-export the interface for consumers
export type { IAssetsProvider } from './IAssetsProvider'
