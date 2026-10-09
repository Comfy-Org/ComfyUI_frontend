import { toValue } from 'vue'

import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import { isAssetPreviewSupported } from '@/platform/assets/utils/assetPreviewUtil'
import { getGeneratedPreviewUrl } from '@/platform/assets/utils/assetUrlUtil'

export function useGeneratedPreviewLookup() {
  const assetLists = isAssetPreviewSupported()
    ? [
        useAssetsQuery({ tags_any: ['input'] }),
        useAssetsQuery({ tags_any: ['output', 'temp'] })
      ]
    : []

  return (filename: string | undefined): string => {
    const asset = assetLists
      .flatMap((list) => toValue(list.items))
      .find(({ hash, name }) => hash === filename || name === filename)
    return asset ? getGeneratedPreviewUrl(asset) : ''
  }
}
