import type { WorkshopModel } from '@/config/models-catalogue'
import {
  catalogSearch,
  sortWorkshopModels,
  useCaseFor
} from '@/config/models-catalogue'
import { getWorkshopModel } from '@/config/workshop-browse-content'
import {
  getWorkshopPageDetail,
  workshopPages
} from '@/config/workshop-page-content'
import { estimateWorkshopNodePrice } from '@/config/workshop-node-pricing'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { describesCapability } from '@/lib/workshop/model-tags'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { workflowsUsingModel } from '@/lib/workshop/model-workflows'
import { durationsIn, resolutionRange } from '@/lib/workshop/model-ranges'

const TAGS_SHOWN = 3

function splitShownTags<T>(tags: readonly T[]) {
  const shownTags = tags.slice(0, TAGS_SHOWN)
  const restTags = tags.slice(TAGS_SHOWN)
  return { shownTags, restTags, restTagCount: restTags.length }
}

export function modelOgImage(
  model: Pick<WorkshopModel, 'thumbnail'>
): string | undefined {
  return model.thumbnail?.kind === 'image'
    ? model.thumbnail.url
    : model.thumbnail?.poster
}

function priceOf(model: WorkshopModel) {
  return estimateWorkshopNodePrice(
    model,
    model.useCases?.length === 1 ? model.useCases[0] : undefined
  )
}

/** The provider's other model pages, most recommended first, as table rows. */
async function providerModelRows(model: WorkshopModel) {
  const { provider } = model
  if (!provider) return []
  const others = sortWorkshopModels(
    workshopPages.filter(
      (other) =>
        other.routerId !== undefined &&
        other.href !== undefined &&
        other.slug !== model.slug &&
        other.provider === provider
    ),
    'popular'
  )
  return Promise.all(
    others.map(async (other) => {
      const duration = durationsIn(
        getWorkshopPageDetail(other.slug)?.execution?.inputSchema
      )
      const resolution = resolutionRange(other.resolutions)
      const price = await priceOf(other)
      return {
        slug: other.slug,
        name: other.name,
        href: other.href ?? '',
        provider,
        ...(price && { price }),
        ...(resolution && { resolution }),
        ...(duration && { duration })
      }
    })
  )
}

export async function prepareModelPage(
  slug: string | undefined,
  locale: Locale = 'en'
) {
  const { t } = translationsFor(locale)
  const model = slug ? getWorkshopPageDetail(slug) : undefined
  if (!model) throw new Error(`Unknown Models route: ${slug ?? '(missing)'}`)
  const { href } = model
  if (!href)
    throw new Error(
      `Models route ${slug} resolved to ${model.slug}, which has no page`
    )
  if (slug !== model.slug) return { kind: 'redirect', href } as const
  const useCase = useCaseFor(model)
  const tags = model.capabilities
    .filter((capability) => describesCapability(capability, model))
    .map((capability) => ({
      label: capability,
      search: catalogSearch({ query: capability })
    }))
  return {
    kind: 'page' as const,
    model: { ...model, href },
    providerModels: await providerModelRows(model),
    successor: model.successorSlug
      ? getWorkshopModel(model.successorSlug)
      : undefined,
    priceEstimate: await priceOf(model),
    useCaseLabel: useCase ? t(useCaseLabelKey[useCase]) : undefined,
    workflows: model.routerId ? workflowsUsingModel(model, workshopPages) : [],
    tags,
    ...splitShownTags(tags)
  }
}
