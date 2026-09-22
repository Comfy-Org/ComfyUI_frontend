import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const MEDIA = new Map<string, TranslationKey>([
  ['image', 'workshop.hub.io.image'],
  ['video', 'workshop.hub.io.video'],
  ['audio', 'workshop.hub.io.audio'],
  ['3d', 'workshop.hub.io.3d']
])

/** The medium in the reader's words, or the raw type for anything unmapped. */
export function mediaLabel(media: string, locale: Locale = 'en'): string {
  const known = MEDIA.get(media)
  return known ? t(known, locale) : media
}
