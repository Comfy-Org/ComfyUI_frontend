import { AudioLines, Box, FileText, Image, Video } from '@lucide/vue'
import type { Component } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const MEDIA = new Map<string, { icon: Component; label: TranslationKey }>([
  ['image', { icon: Image, label: 'workshop.hub.io.image' }],
  ['video', { icon: Video, label: 'workshop.hub.io.video' }],
  ['audio', { icon: AudioLines, label: 'workshop.hub.io.audio' }],
  ['3d', { icon: Box, label: 'workshop.hub.io.3d' }]
])

export function mediaIcon(media: string): Component {
  return MEDIA.get(media)?.icon ?? FileText
}

/** The medium in the reader's words, or the raw type for anything unmapped. */
export function mediaLabel(media: string, locale: Locale = 'en'): string {
  const known = MEDIA.get(media)
  return known ? t(known.label, locale) : media
}
