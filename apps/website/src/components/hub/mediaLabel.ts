import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'

const MEDIA = new Map<string, HubKey>([
  ['image', 'workshop.hub.io.image'],
  ['video', 'workshop.hub.io.video'],
  ['audio', 'workshop.hub.io.audio'],
  ['3d', 'workshop.hub.io.3d']
])

/** The medium in the reader's words, or the raw type for anything unmapped. */
export function mediaLabel(media: string, locale: Locale = 'en'): string {
  const known = MEDIA.get(media)
  return known ? tHub(known, locale) : media
}
