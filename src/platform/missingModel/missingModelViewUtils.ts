import type { MissingModelGroup } from '@/platform/missingModel/types'
import {
  getModelSources,
  isModelDownloadable
} from '@/platform/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'

export function toDownloadableModel(
  model: MissingModelGroup['models'][number]
): ModelWithUrl | null {
  const { name, url, directory, sources } = model.representative
  if (!url || !directory) return null

  const source = getModelSources({ url, sources }).find((candidate) =>
    isModelDownloadable({ name, url: candidate.url, directory })
  )
  if (!source) return null

  return {
    name,
    url: source.url,
    directory,
    ...(sources ? { sources } : {})
  }
}

export function getDownloadableModels(
  groups: MissingModelGroup[]
): ModelWithUrl[] {
  return groups.flatMap((group) =>
    group.models.flatMap((model) => toDownloadableModel(model) ?? [])
  )
}
