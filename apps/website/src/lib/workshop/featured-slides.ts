import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import type { FeaturedSlide } from '../../components/workshop/FeaturedBanner.vue'
import type { BrowseEntry } from '../hub/browse-entry'
import { bannerName } from './banner-name'
import { modelDocsHref } from './model-docs'
import { taskLabelFor } from './task-label'

const TAG_LIMIT = 3

// Audio has no frame to fill a banner with, so a slide without one leads with
// the ground instead.
type SlideMedia = { readonly url: string; readonly kind: string } | undefined
const withFrame = (media: SlideMedia): FeaturedSlide['media'] =>
  media && media.kind !== 'audio'
    ? { url: media.url, kind: media.kind === 'video' ? 'video' : 'image' }
    : undefined

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
    media: withFrame(model.thumbnail),
    docsHref: modelDocsHref(model)
  }))
}

// The catalogue's cards already carry everything a slide shows, so featuring a
// workflow costs no second projection and no second trip to the server.
export function entrySlides(
  entries: readonly BrowseEntry[],
  kindLabel: (entry: BrowseEntry) => string
): FeaturedSlide[] {
  return entries.map((entry) => ({
    key: entry.key,
    href: entry.card.href,
    title: entry.title,
    kind: kindLabel(entry),
    tags: entry.card.maker.label ? [entry.card.maker.label] : [],
    summary: undefined,
    media: withFrame(entry.card.media),
    docsHref: undefined
  }))
}
