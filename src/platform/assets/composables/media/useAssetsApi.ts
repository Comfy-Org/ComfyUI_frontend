import { useSharedAssetsQuery } from '@/platform/remote/paged/assets'
import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'

export function useAssetsApi(directory: 'input' | 'output') {
  //FIXME: Shouldn't define the flag here
  if (api.getServerFeature('assets') === false) {
    if (directory === 'output') return useAssetsStore().historyAssets
    else return useAssetsStore().historyInputs
  }
  return useSharedAssetsQuery({ include_tags: [directory] })
}
