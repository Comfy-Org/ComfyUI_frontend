import assignments from '../src/data/workshop-content-use-cases.json'
import { z } from 'astro/zod'
import {
  WORKSHOP_USE_CASES,
  workshopContentSlug,
  workshopDisplaySchema,
  workshopDisplayEntriesSchema
} from '../src/content/workshop-display.schema'
import type {
  WorkshopDisplayEntry,
  WorkshopDisplaySource
} from '../src/content/workshop-display.schema'

const mediaUseCases = new Map(
  Object.entries(
    z.record(z.string(), z.enum(WORKSHOP_USE_CASES)).parse(assignments)
  )
)

export function splitWorkshopDisplay(
  sources: readonly WorkshopDisplaySource[]
): WorkshopDisplayEntry[] {
  const entries = sources.flatMap((source) => {
    const { id: modelId, useCases, ...content } = source
    const mediaUseCase =
      useCases.length === 1 ? useCases[0] : mediaUseCases.get(modelId)
    if (!mediaUseCase)
      throw new Error(`Choose a media use case before splitting ${modelId}`)
    if (!useCases.includes(mediaUseCase))
      throw new Error(
        `Media use case ${mediaUseCase} is not declared for ${modelId}`
      )
    return useCases.map((useCase) => {
      const slug = workshopContentSlug(modelId, useCase)
      return {
        ...content,
        id: slug,
        slug,
        modelId,
        useCase,
        ...(useCase === mediaUseCase
          ? {}
          : {
              media: {},
              examples: [],
              mediaConfidence: 'none',
              needsReview: true
            })
      }
    })
  })
  return workshopDisplayEntriesSchema.parse(
    withholdSharedMedia(
      entries.map((entry) => workshopDisplaySchema.parse(entry))
    )
  )
}

function withholdSharedMedia(
  entries: readonly WorkshopDisplayEntry[]
): WorkshopDisplayEntry[] {
  const useCasesByUrl = new Map<string, Set<string>>()
  for (const entry of entries) {
    for (const asset of [
      entry.media.thumbnail,
      ...(entry.media.samples ?? [])
    ]) {
      if (!asset) continue
      const cases = useCasesByUrl.get(asset.url) ?? new Set<string>()
      cases.add(entry.useCase)
      useCasesByUrl.set(asset.url, cases)
    }
  }
  const shared = (url: string) => (useCasesByUrl.get(url)?.size ?? 0) > 1
  return entries.map((entry) => {
    const thumbnail = entry.media.thumbnail
    const pairs = (entry.media.samples ?? []).map((sample, index) => ({
      sample,
      example: entry.examples.at(index)
    }))
    const kept = pairs.filter(({ sample }) => !shared(sample.url))
    const withheld = pairs.filter(({ sample }) => shared(sample.url))
    const sharedThumbnail = thumbnail && shared(thumbnail.url)
    if (!sharedThumbnail && !withheld.length) return entry
    return {
      ...entry,
      media: {
        ...(thumbnail && !sharedThumbnail ? { thumbnail } : {}),
        samples: kept.map(({ sample }) => sample)
      },
      examples: kept.flatMap(({ example }) => (example ? [example] : [])),
      needsReview: true,
      withheldContent: {
        reason: 'shared-across-use-cases',
        media: {
          ...(sharedThumbnail ? { thumbnail } : {}),
          samples: withheld.map(({ sample }) => sample)
        },
        examples: withheld.flatMap(({ example }) => (example ? [example] : []))
      }
    }
  })
}
