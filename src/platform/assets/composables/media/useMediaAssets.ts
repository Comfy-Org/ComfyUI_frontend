import type { IAssetsProvider } from './IAssetsProvider'
import { useAssetsApi } from './useAssetsApi'

export function useMediaAssets(directory: 'input' | 'output'): IAssetsProvider {
  return useAssetsApi(directory)
}
