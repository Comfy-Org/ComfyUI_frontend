import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type { GeneratedExample, WorkshopModelDetail } from './models-catalogue'
import { formForContract } from './workshop-contract'
import { workshopContract } from './workshop-contract-catalog'
import { workshopPromptDefaults } from './workshop-prompt-defaults'
import type { WorkshopContract } from './workshop-contract'
import { workshopExampleValues } from './workshop-example-values'
import {
  routerContentBySlug,
  routerModelSlugAliases,
  routerWorkshopModels
} from './workshop-browse-content'

function examplesFor(
  model: WorkshopModelDetail,
  display: WorkshopDisplayEntry
): GeneratedExample[] {
  const samples = display.media.samples ?? []
  return samples.slice(0, 6).map((sample, index) => {
    const example = display.examples.at(index)
    const values =
      model.execution && example
        ? {
            ...workshopPromptDefaults(model, [
              {
                ...display,
                examples: [example],
                media: { ...display.media, samples: [sample] }
              }
            ]),
            ...workshopExampleValues(model.execution, example.values)
          }
        : {}
    return {
      name: `${display.slug}-example-${index + 1}`,
      title: example?.title ?? `Sample ${index + 1}`,
      description: example?.description ?? '',
      tags: model.capabilities,
      thumbnailUrl: sample.url,
      mediaKind: sample.kind,
      sampleOnly: Object.keys(values).length === 0,
      values
    }
  })
}

function executionFor(
  catalogId: string,
  contentId: string
): WorkshopContract | undefined {
  const contract = workshopContract(catalogId)
  if (!contract) return
  const { creatorVariants, ...base } = contract
  const creator = creatorVariants?.[contentId] ?? contract.creator
  return { ...base, ...(creator ? { creator } : {}) }
}

const detailBySlug = new Map(
  routerWorkshopModels.map((model) => {
    const source = routerContentBySlug.get(model.slug)
    if (!source) throw new Error(`Missing content record: ${model.slug}`)
    const execution = model.incompleteReason
      ? undefined
      : executionFor(source.record.catalogId, source.overlay.id)
    if (execution && execution.sourceCommit !== source.alias.sourceCommit)
      throw new Error(`Stale Router identity audit: ${model.routerId}`)
    const detail: WorkshopModelDetail = {
      ...model,
      ...(execution ? { execution, form: formForContract(execution) } : {}),
      fields: [],
      defaults: {},
      examples: []
    }
    return [
      model.slug,
      {
        ...detail,
        examples: source.alias.contentIssue
          ? []
          : examplesFor(detail, source.overlay),
        defaults: {
          ...workshopPromptDefaults(
            detail,
            source.alias.contentIssue ? [] : [source.overlay]
          ),
          ...(execution && !source.alias.contentIssue
            ? workshopExampleValues(
                execution,
                source.overlay.examples.at(0)?.values ?? {}
              )
            : {})
        }
      }
    ]
  })
)

export function getRouterWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  return detailBySlug.get(routerModelSlugAliases.get(slug) ?? slug)
}
