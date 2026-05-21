import type { MissingModelGroup } from '@/platform/missingModel/types'
import { isModelDownloadable } from '@/platform/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'

export function getModelStateKey(
  modelName: string,
  directory: string | null,
  isAssetSupported: boolean
): string {
  const prefix = isAssetSupported ? 'supported' : 'unsupported'
  return `${prefix}::${directory ?? ''}::${modelName}`
}

export function toDownloadableModel(
  model: MissingModelGroup['models'][number]
): ModelWithUrl | null {
  const { name, url, directory } = model.representative
  if (!url || !directory) return null

  const downloadableModel = { name, url, directory }
  return isModelDownloadable(downloadableModel) ? downloadableModel : null
}

export function getDownloadableModelEntries(
  groups: MissingModelGroup[]
): Array<{ key: string; model: ModelWithUrl }> {
  return groups.flatMap((group) =>
    group.models.flatMap((model) => {
      const downloadableModel = toDownloadableModel(model)
      if (!downloadableModel) return []

      return [
        {
          key: getModelStateKey(
            model.name,
            group.directory,
            group.isAssetSupported
          ),
          model: downloadableModel
        }
      ]
    })
  )
}

export function getDownloadableModels(
  groups: MissingModelGroup[]
): ModelWithUrl[] {
  return getDownloadableModelEntries(groups).map(({ model }) => model)
}
