import { useSharedAssetsQuery } from '@/platform/remote/paged/assets'
import { useAssetsStore } from '@/stores/assetsStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

export function useAssetsApi(directory: 'input' | 'output') {
  //FIXME: Shouldn't define the flag here
  if (!useFeatureFlags().flags.assetsEnabled) {
    if (directory === 'output') return useAssetsStore().historyAssets
    else return useAssetsStore().historyInputs
  }
  return useSharedAssetsQuery({ include_tags: [directory] })
}
