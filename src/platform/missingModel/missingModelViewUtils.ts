import type { MissingModelGroup } from '@/platform/missingModel/types'
import { isModelDownloadable } from '@/platform/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'

export function toDownloadableModel(
  model: MissingModelGroup['models'][number]
): ModelWithUrl | null {
  const { name, url, directory } = model.representative
  if (!url || !directory) return null

  const downloadableModel = { name, url, directory }
  return isModelDownloadable(downloadableModel) ? downloadableModel : null
}

export function getDownloadableModels(
  groups: MissingModelGroup[]
): ModelWithUrl[] {
  return groups.flatMap((group) =>
    group.models.flatMap((model) => toDownloadableModel(model) ?? [])
  )
}
