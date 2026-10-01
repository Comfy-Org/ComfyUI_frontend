import type { Component } from 'vue'

import type {
  BackgroundRemoval,
  CutoutTray
} from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import type { CutoutCopyKey } from '../../../lib/workshop/background-removal/copy'
import { brc } from '../../../lib/workshop/background-removal/copy'
import BackgroundRemovalAdvanced from './BackgroundRemovalAdvanced.vue'
import BackgroundRemovalBackgrounds from './BackgroundRemovalBackgrounds.vue'
import BackgroundRemovalFormat from './BackgroundRemovalFormat.vue'

/**
 * Background Removal's controls in panel order. In the side panel each is
 * a collapsible section; in the bottom composer each opens as a tray.
 */
export const CUTOUT_SECTIONS = [
  {
    id: 'background',
    title: 'cutout.background',
    content: BackgroundRemovalBackgrounds,
    open: true
  },
  {
    id: 'format',
    title: 'cutout.format',
    content: BackgroundRemovalFormat,
    open: true
  },
  {
    id: 'advanced',
    title: 'cutout.advanced',
    content: BackgroundRemovalAdvanced,
    open: false
  }
] as const satisfies readonly {
  id: CutoutTray
  title: CutoutCopyKey
  content: Component
  open: boolean
}[]

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: CutoutTray,
  cutout: BackgroundRemoval,
  locale: Locale
): string {
  const { background, format, edgeSoftness } = cutout.setup.value
  const notes = {
    background: () => brc(`cutout.background.${background}`, locale),
    format: () => brc(`cutout.format.${format}`, locale),
    advanced: () => brc('cutout.advanced.value', locale, { n: edgeSoftness })
  } as const satisfies Record<CutoutTray, () => string>
  return notes[id]()
}

/** The one-line summary of the setup, for the collapsed phone sheet. */
export function setupSummary(cutout: BackgroundRemoval, locale: Locale) {
  return brc('cutout.summary', locale, {
    background: sectionMeta('background', cutout, locale),
    format: sectionMeta('format', cutout, locale)
  })
}
