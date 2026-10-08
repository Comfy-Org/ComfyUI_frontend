import type { WorkshopModel } from '@/config/models-catalogue'
import { appModels } from '@/config/workshop-app-content'
import { workshopPages } from '@/config/workshop-page-content'
import { getMainNavigation } from '@/data/mainNavigation'
import type { HubMenuPreviews, NavItemPreview } from '@/data/mainNavigation'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'

const MEDIUM_LABEL: Partial<Record<string, TranslationKey>> = {
  image: 'workshop.task.image',
  video: 'workshop.task.video',
  audio: 'workshop.task.audio',
  text: 'workshop.task.text'
}

function metaOf(
  model: WorkshopModel,
  t: ReturnType<typeof translationsFor>['t']
): string | undefined {
  if (model.type === 'APP') return model.summary
  if (model.workflowId !== undefined) {
    const useCase = model.useCases?.[0]
    return useCase ? t(useCaseLabelKey[useCase]) : undefined
  }
  const medium = model.modality && MEDIUM_LABEL[model.modality]
  const parts = [model.provider, medium ? t(medium) : undefined].filter(
    (part): part is string => Boolean(part)
  )
  return parts.length ? parts.join(' · ') : undefined
}

/** What the Hub menu shows beside each of its entries, keyed by page. */
export function hubMenuPreviewsFor(
  models: readonly WorkshopModel[],
  hrefs: readonly string[],
  locale: Locale
): HubMenuPreviews {
  const { t } = translationsFor(locale)
  const wanted = new Set(hrefs)
  return Object.fromEntries(
    models.flatMap((model): [string, NavItemPreview][] =>
      model.href && wanted.has(model.href)
        ? [[model.href, { meta: metaOf(model, t) }]]
        : []
    )
  )
}

export function hubMenuPreviews(locale: Locale): HubMenuPreviews {
  const hrefs = getMainNavigation(locale, true, { workflows: true, apps: true })
    .flatMap((item) => item.columns ?? [])
    .filter((column) => column.kind)
    .flatMap((column) => column.items.map((item) => item.href))
  return hubMenuPreviewsFor([...workshopPages, ...appModels], hrefs, locale)
}
