import type { Component } from 'vue'

import type {
  PaparazziMe,
  PaparazziTray
} from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import type { PaparazziCopyKey } from '../../../lib/workshop/paparazzi-me/copy'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import type { PaparazziSetup } from '../../../lib/workshop/paparazzi-me/setup'
import {
  SCENE_LABELS,
  isCustomScene
} from '../../../lib/workshop/paparazzi-me/setup'
import PaparazziAdvanced from './PaparazziAdvanced.vue'
import PaparazziResolution from './PaparazziResolution.vue'
import PaparazziScene from './PaparazziScene.vue'
import PaparazziStar from './PaparazziStar.vue'

/**
 * Paparazzi me's controls in panel order. In the side panel each is a
 * collapsible section; in the bottom composer each opens as a tray.
 */
export const PAPARAZZI_SECTIONS = [
  { id: 'star', title: 'paparazzi.star', content: PaparazziStar, open: true },
  {
    id: 'scene',
    title: 'paparazzi.scene',
    content: PaparazziScene,
    open: true
  },
  {
    id: 'resolution',
    title: 'paparazzi.resolution',
    content: PaparazziResolution,
    open: false
  },
  {
    id: 'advanced',
    title: 'paparazzi.advanced',
    content: PaparazziAdvanced,
    open: false
  }
] as const satisfies readonly {
  id: PaparazziTray
  title: PaparazziCopyKey
  content: Component
  open: boolean
}[]

export function sceneName(setup: PaparazziSetup, locale: Locale): string {
  return isCustomScene(setup)
    ? pc('paparazzi.scene.custom', locale)
    : pc(SCENE_LABELS[setup.scene], locale)
}

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: PaparazziTray,
  paparazzi: PaparazziMe,
  locale: Locale
): string {
  const setup = paparazzi.setup.value
  const notes = {
    star: () => setup.celebrity.trim(),
    scene: () => sceneName(setup, locale),
    resolution: () => setup.resolution,
    advanced: () => pc('paparazzi.seed.value', locale, { n: setup.seed })
  } as const satisfies Record<PaparazziTray, () => string>
  return notes[id]()
}

/** The one-line summary of a whole setup, for the collapsed phone sheet. */
export function setupSummary(paparazzi: PaparazziMe, locale: Locale): string {
  const setup = paparazzi.setup.value
  return pc('paparazzi.summary', locale, {
    name: setup.celebrity.trim() || '…',
    scene: sceneName(setup, locale),
    resolution: setup.resolution
  })
}
