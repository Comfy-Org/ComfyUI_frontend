import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { COMFY_LOGO_PATH, getLogoPath } from '@/lib/hub/model-logos'
import { featuredModels } from './models-hub'

export interface CatalogueFeature {
  readonly key: string
  readonly badge: string
  readonly source: { readonly label: string; readonly logo: string | null }
  readonly title: string
  readonly summary?: string
  readonly href: string
  readonly cta: string
  readonly ctaLabel: string
  readonly media: Pick<WorkshopModel, 'name' | 'thumbnail'>
  readonly still?: string
  readonly price?: string
}

const FEATURED_MODEL_COUNT = 5
const FEATURED_WORKFLOW_COUNT = 4

function stillOf({ thumbnail }: Pick<WorkshopModel, 'thumbnail'>) {
  return thumbnail?.kind === 'image' ? thumbnail.url : thumbnail?.poster
}

/** The Models header's slides: the newest launches, then the most popular. */
export function modelFeatures(
  models: readonly WorkshopModel[],
  locale: Locale = 'en'
): CatalogueFeature[] {
  const { t } = translationsFor(locale)
  return featuredModels(models, FEATURED_MODEL_COUNT).map(
    ({ model, launch }) => ({
      key: model.slug,
      badge: launch
        ? t('workshop.featured.new')
        : t('workshop.explore.popularTitle'),
      source: {
        label: model.provider ?? t('workshop.card.partnerNode'),
        logo: getLogoPath(model.provider ?? '') ?? getLogoPath(model.name)
      },
      title: model.name,
      summary: model.summary,
      href: model.href ?? '',
      cta: t('workshop.featured.tryModel'),
      ctaLabel: t('workshop.explorer.compare.try', { name: model.name }),
      media: model,
      still: stillOf(model),
      price: model.priceEstimate
    })
  )
}

/** The Workflows header's slides: the most recommended workflows with a still. */
export function workflowFeatures(
  workflows: readonly WorkflowWorkshopModel[],
  locale: Locale = 'en'
): CatalogueFeature[] {
  const { t } = translationsFor(locale)
  return workflows
    .filter((workflow) => stillOf(workflow) !== undefined)
    .toSorted(
      (a, b) =>
        (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
    )
    .slice(0, FEATURED_WORKFLOW_COUNT)
    .map((workflow) => ({
      key: workflow.slug,
      badge: t('workshop.sections.featured'),
      source: {
        label: t('workshop.featured.comfyWorkflow'),
        logo: COMFY_LOGO_PATH
      },
      title: workflow.name,
      summary: workflow.summary,
      href: workflow.href,
      cta: t('workshop.featured.openWorkflow'),
      ctaLabel: t('workshop.featured.openWorkflowNamed', {
        name: workflow.name
      }),
      media: workflow,
      still: stillOf(workflow)
    }))
}
