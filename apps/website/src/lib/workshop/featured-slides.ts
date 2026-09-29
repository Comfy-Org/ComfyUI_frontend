import type { WorkshopModel } from '../../config/models-catalogue'
import type { FeaturedSlide } from '../../components/workshop/FeaturedBanner.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { getRoutes } from '../../config/routes'
import { bannerName } from './banner-name'
import { modelDocsHref } from './model-docs'
import { taskLabelFor } from './task-label'

const TAG_LIMIT = 3

// A video fills the banner where the model has one; otherwise the still its
// card already carries. A model with neither leads with the ground.
function slideMedia(model: WorkshopModel): FeaturedSlide['media'] {
  if (model.thumbnail?.kind === 'video')
    return { url: model.thumbnail.url, kind: 'video' }
  return model.thumbnailUrl
    ? { url: model.thumbnailUrl, kind: 'image' }
    : undefined
}

export function modelSlides(
  models: readonly WorkshopModel[],
  locale: Locale
): FeaturedSlide[] {
  return models.map((model) => ({
    key: model.slug,
    href: model.href,
    title: bannerName(model.name, taskLabelFor(model, 'en')),
    kind: taskLabelFor(model, locale),
    tags: model.capabilities.slice(0, TAG_LIMIT),
    summary: model.summary,
    media: slideMedia(model),
    docsHref: modelDocsHref(model)
  }))
}

export function studioSlide(locale: Locale): FeaturedSlide {
  return {
    key: 'cinematic-studio',
    href: getRoutes(locale).cinematicStudio,
    title: t('nav.cinematicStudio', locale),
    kind: t('workshop.cinematic.badge', locale),
    tags: [],
    summary: t('workshop.cinematic.summary', locale),
    media: { url: '/images/cinematic-studio/neon-street.jpg', kind: 'image' },
    docsHref: undefined,
    cta: t('workshop.cinematic.cta', locale)
  }
}
