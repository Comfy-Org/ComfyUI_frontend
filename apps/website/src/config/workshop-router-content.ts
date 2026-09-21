import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type {
  GeneratedExample,
  WorkshopModel,
  WorkshopModelDetail
} from './models-catalogue'
import { formForContract } from './workshop-contract'
import { workshopContract } from './workshop-contract-catalog'
import { workshopPromptDefaults } from './workshop-prompt-defaults'
import type { WorkshopContract } from './workshop-contract'
import { workshopExampleValues } from './workshop-example-values'
import {
  authoredRouterModelSlugAliases,
  authoredRouterContentBySlug,
  authoredWorkshopModels,
  routerContentBySlug,
  routerModelSlugAliases,
  workshopModels
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
            ...model.defaults,
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

type RouterContentSource = NonNullable<
  ReturnType<(typeof routerContentBySlug)['get']>
>

function defaultsFor(
  detail: WorkshopModelDetail,
  source: RouterContentSource,
  execution: WorkshopContract | undefined
) {
  const hasContent = !source.binding.contentIssue
  return {
    ...detail.defaults,
    ...workshopPromptDefaults(detail, hasContent ? [source.overlay] : []),
    ...(execution && hasContent
      ? workshopExampleValues(
          execution,
          source.overlay.examples.at(0)?.values ?? {}
        )
      : {})
  }
}

function detailFor(
  model: WorkshopModel,
  contentBySlug: ReadonlyMap<string, RouterContentSource>
): WorkshopModelDetail {
  const source = contentBySlug.get(model.slug)
  if (!source) throw new Error(`Missing content record: ${model.slug}`)
  const execution = model.incompleteReason
    ? undefined
    : executionFor(source.record.catalogId, source.overlay.id)
  if (execution && execution.sourceCommit !== source.binding.sourceCommit)
    throw new Error(`Stale Router identity audit: ${model.routerId}`)
  const detail: WorkshopModelDetail = {
    ...model,
    ...(execution ? { execution, form: formForContract(execution) } : {}),
    fields: [],
    defaults: execution
      ? workshopExampleValues(execution, source.binding.nativeDefaults ?? {})
      : {},
    examples: []
  }
  return {
    ...detail,
    examples: source.binding.contentIssue
      ? []
      : examplesFor(detail, source.overlay),
    defaults: defaultsFor(detail, source, execution)
  }
}

const detailBySlug = new Map(
  workshopModels.map((model) => [
    model.slug,
    detailFor(model, routerContentBySlug)
  ])
)
const authoredDetailBySlug = new Map(
  authoredWorkshopModels.map((model) => [
    model.slug,
    detailFor(model, authoredRouterContentBySlug)
  ])
)

export function getAuthoredRouterWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  return authoredDetailBySlug.get(
    authoredRouterModelSlugAliases.get(slug) ?? slug
  )
}

export function getRouterWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  return detailBySlug.get(routerModelSlugAliases.get(slug) ?? slug)
}
