import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { GeneratedExample, WorkshopModelDetail } from './models-catalogue'
import { formForContract } from './workshop-contract'
import { workshopContract } from './workshop-contract-catalog'
import { workshopPromptDefaults } from './workshop-prompt-defaults'
import {
  routerContentById,
  routerModelSlugAliases,
  routerWorkshopModels
} from './workshop-browse-content'

function examplesFor(
  model: WorkshopModelEntry,
  display: WorkshopDisplayEntry
): GeneratedExample[] {
  const samples = display.media.samples ?? []
  return samples.slice(0, 6).map((sample, index) => {
    const example = display.examples.at(index)
    return {
      name: `${model.slug}-example-${index + 1}`,
      title: example?.title ?? `Sample ${index + 1}`,
      description: example?.description ?? '',
      tags: model.tags,
      thumbnailUrl: sample.url,
      mediaKind: sample.kind,
      sampleOnly: true,
      values: {}
    }
  })
}

const detailBySlug = new Map(
  routerWorkshopModels.map((model) => {
    const sources = routerContentById.get(model.routerId) ?? []
    const execution = model.incompleteReason
      ? undefined
      : workshopContract(model.routerId)
    if (
      execution &&
      sources.some(({ alias }) => execution.sourceCommit !== alias.sourceCommit)
    )
      throw new Error(`Stale Router identity audit: ${model.routerId}`)
    const samples = sources
      .filter(({ alias }) => !alias.contentIssue)
      .flatMap(({ entry, overlay }) => examplesFor(entry, overlay))
      .slice(0, 6)
    const detail: WorkshopModelDetail = {
      ...model,
      ...(execution ? { execution, form: formForContract(execution) } : {}),
      fields: [],
      defaults: {},
      examples: samples
    }
    return [
      model.slug,
      {
        ...detail,
        defaults: workshopPromptDefaults(
          detail,
          sources
            .filter(({ alias }) => !alias.contentIssue)
            .map(({ overlay }) => overlay)
        )
      }
    ]
  })
)

export function getRouterWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  return detailBySlug.get(routerModelSlugAliases.get(slug) ?? slug)
}
