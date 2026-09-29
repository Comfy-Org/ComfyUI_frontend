import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type {
  GeneratedExample,
  RouterWorkshopModel,
  RouterWorkshopModelDetail,
  UseCase
} from './models-catalogue'
import { useCasesFor } from './models-catalogue'
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

const PROMPT_TEXT_KEYS = ['prompt', 'text', 'high_level_description']

export function promptText(prompt: unknown): string | undefined {
  if (typeof prompt !== 'string' || !prompt.trim()) return
  if (!prompt.trim().startsWith('{')) return prompt
  let structured: unknown
  try {
    structured = JSON.parse(prompt)
  } catch {
    return
  }
  if (typeof structured !== 'object' || structured === null) return
  const fields = new Map<string, unknown>(Object.entries(structured))
  const text = PROMPT_TEXT_KEYS.map((key) => fields.get(key)).find(
    (value) => typeof value === 'string' && value.trim()
  )
  return typeof text === 'string' ? text : undefined
}

function promptOf(
  sample: { readonly prompt?: string },
  example: { readonly values: Readonly<Record<string, unknown>> } | undefined
): { prompt?: string } {
  const prompt = promptText(
    sample.prompt?.trim() ? sample.prompt : example?.values.prompt
  )
  return prompt ? { prompt } : {}
}

function examplesFor(
  model: RouterWorkshopModelDetail,
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
      values,
      ...promptOf(sample, example)
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
  detail: RouterWorkshopModelDetail,
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
  model: RouterWorkshopModel,
  contentBySlug: ReadonlyMap<string, RouterContentSource>
): RouterWorkshopModelDetail {
  const source = contentBySlug.get(model.slug)
  if (!source) throw new Error(`Missing content record: ${model.slug}`)
  const execution = model.incompleteReason
    ? undefined
    : executionFor(source.record.catalogId, source.overlay.id)
  if (execution && execution.sourceCommit !== source.binding.sourceCommit)
    throw new Error(`Stale Router identity audit: ${model.routerId}`)
  const detail: RouterWorkshopModelDetail = {
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
): RouterWorkshopModelDetail | undefined {
  return authoredDetailBySlug.get(
    authoredRouterModelSlugAliases.get(slug) ?? slug
  )
}

export function getRouterWorkshopModelDetail(
  slug: string
): RouterWorkshopModelDetail | undefined {
  return detailBySlug.get(routerModelSlugAliases.get(slug) ?? slug)
}

/**
 * Resolves a Router API `{provider}/{model}` id (or the legacy catalog id
 * some content is filed under, when the two differ) plus its use case to
 * that model's canonical `/models/[slug]` href, one hop, without going
 * through the redirect a bare `{provider}/{model}` id needs when the same
 * id maps to more than one use case's page.
 */
export function getRouterModelHref(
  modelId: string,
  useCase: UseCase
): string | undefined {
  return workshopModels.find(
    (model) =>
      useCasesFor(model).includes(useCase) &&
      (model.routerId === modelId ||
        routerContentBySlug.get(model.slug)?.entry.id === modelId)
  )?.href
}
