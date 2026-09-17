import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import type { FeaturedSlide } from '../../components/workshop/FeaturedBanner.vue'
import type { HubTemplate } from '../hub/types'
import { tagDisplayName } from '../hub/tag-aliases'
import { taskLabelFor } from './task-label'

const TAG_LIMIT = 3

export function modelSlides(
  models: readonly WorkshopModel[],
  locale: Locale
): FeaturedSlide[] {
  return models.map((model) => ({
    key: model.slug,
    href: model.href,
    title: model.name,
    kind: taskLabelFor(model, locale),
    tags: model.capabilities.slice(0, TAG_LIMIT),
    summary: model.summary,
    thumbnailUrl: model.thumbnailUrl
  }))
}

export function templateSlides(
  templates: readonly HubTemplate[],
  href: (template: HubTemplate) => string
): FeaturedSlide[] {
  return templates.map((template) => ({
    key: template.name,
    href: href(template),
    title: template.title,
    kind: tagDisplayName(template.tags[0] ?? ''),
    tags: template.models.slice(0, TAG_LIMIT),
    thumbnailUrl: template.thumbnails[0]
  }))
}
