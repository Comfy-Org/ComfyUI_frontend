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

  /** An asset id identifies the file exactly; a filename can collide across folders. */
  return (filename: string | undefined, assetId?: string): string => {
    const asset = assetLists
      .flatMap((list) => toValue(list.items))
      .find(({ id, hash, name }) =>
        assetId ? id === assetId : hash === filename || name === filename
      )
    return asset ? getGeneratedPreviewUrl(asset) : ''
  }
}
