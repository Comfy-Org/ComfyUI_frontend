import type { Component } from 'vue'

import type {
  BackgroundRemoval,
  CutoutTray
} from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import type {
  CutoutBackground,
  ReplaceModel
} from '../../../lib/workshop/background-removal/contract'
import {
  REPLACE_MODELS,
  backgroundSwatch
} from '../../../lib/workshop/background-removal/contract'
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

/** A Remove background's name: its swatch, or the custom colour's hex. */
function backgroundName(background: CutoutBackground, locale: Locale) {
  const swatch = backgroundSwatch(background)
  if (swatch) return brc(`cutout.swatch.${swatch.id}`, locale)
  return background.kind === 'color' ? background.color.toUpperCase() : ''
}

export function modelName(model: ReplaceModel, locale: Locale) {
  const label = REPLACE_MODELS.find(({ id }) => id === model)?.label
  return label ?? brc('cutout.replace.model.auto', locale)
}

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: CutoutTray,
  cutout: BackgroundRemoval,
  locale: Locale
): string {
  const { mode, background, replace, adjust, format, edgeSoftness } =
    cutout.setup.value
  const modes = {
    remove: () => backgroundName(background, locale),
    replace: () =>
      brc('cutout.replace.value', locale, {
        model: modelName(replace.model, locale)
      }),
    adjust: () =>
      brc('cutout.adjust.value', locale, {
        target: brc(`cutout.adjust.target.${adjust.target}`, locale)
      })
  } as const
  const notes = {
    background: modes[mode],
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
