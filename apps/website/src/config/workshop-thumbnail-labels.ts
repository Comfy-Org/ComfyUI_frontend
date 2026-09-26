import { z } from 'zod'

import labelsJson from '../data/workshop-thumbnail-labels.json'
import type { WorkshopModel } from './models-catalogue'
import { workshopExecutionId } from './models-catalogue'

const thumbnailLabels = z
  .record(z.string(), z.string().trim().min(1).max(12))
  .parse(labelsJson)

export function labelSharedThumbnails<T extends WorkshopModel>(
  models: readonly T[],
  labels: Readonly<Record<string, string>> = thumbnailLabels
): readonly T[] {
  const owners = new Map<string, Set<string>>()
  for (const model of models) {
    if (!model.thumbnail) continue
    const key = `${model.thumbnail.kind}:${model.thumbnail.url}`
    const ids = owners.get(key) ?? new Set<string>()
    ids.add(workshopExecutionId(model))
    owners.set(key, ids)
  }
  return models.map((model) => {
    if (!model.thumbnail) return model
    const key = `${model.thumbnail.kind}:${model.thumbnail.url}`
    const label = labels[workshopExecutionId(model)]
    return (owners.get(key)?.size ?? 0) > 1 && label
      ? { ...model, thumbnailLabel: label }
      : model
  })
}
