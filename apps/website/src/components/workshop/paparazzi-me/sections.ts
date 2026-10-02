import type { Component } from 'vue'

import type {
  PaparazziMe,
  PaparazziTray
} from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import type { PaparazziCopyKey } from '../../../lib/workshop/paparazzi-me/copy'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_RUN_MS } from '../../../lib/workshop/paparazzi-me/mock-run'
import type { RunProgress } from '../app-editor/run-progress'
import PaparazziFaceRow from './PaparazziFaceRow.vue'
import PaparazziSceneGrid from './PaparazziSceneGrid.vue'
import PaparazziSeed from './PaparazziSeed.vue'
import PaparazziStar from './PaparazziStar.vue'

/** Paparazzi me's controls as the bottom composer's trays, in panel order. */
export const PAPARAZZI_SECTIONS = [
  { id: 'face', title: 'paparazzi.face', content: PaparazziFaceRow },
  { id: 'star', title: 'paparazzi.star', content: PaparazziStar },
  { id: 'scene', title: 'paparazzi.scene', content: PaparazziSceneGrid },
  { id: 'seed', title: 'paparazzi.seed', content: PaparazziSeed }
] as const satisfies readonly {
  id: PaparazziTray
  title: PaparazziCopyKey
  content: Component
}[]

/**
 * Where a run is at `nowMs`: queued through the look-up and the first
 * tenth, then a share of the render.
 */
export function runProgress(
  paparazzi: PaparazziMe,
  nowMs: number
): RunProgress | undefined {
  const current = paparazzi.phase.value
  if (current.kind !== 'running') return undefined
  const elapsed = Math.max(0, nowMs - current.startedAt)
  const percent = Math.min(99, Math.round((elapsed / PAPARAZZI_RUN_MS) * 100))
  return paparazzi.search.value.kind === 'searching' || percent < 10
    ? { kind: 'queued' }
    : { kind: 'running', percent }
}

/** The scene in words: the photo's place, the visitor's own, or none yet. */
export function sceneName(paparazzi: PaparazziMe, locale: Locale): string {
  const scene = paparazzi.scene.value
  if (!scene) return pc('paparazzi.scene.idle', locale)
  return scene.kind === 'own'
    ? pc('paparazzi.scene.own', locale)
    : pc(scene.candidate.place.label, locale)
}

/** The scene photo's thumbnail, or undefined before there is one. */
export function sceneThumb(paparazzi: PaparazziMe): string | undefined {
  const scene = paparazzi.scene.value
  if (!scene) return undefined
  return scene.kind === 'own' ? scene.image.url : scene.candidate.place.thumb
}

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: PaparazziTray,
  paparazzi: PaparazziMe,
  locale: Locale
): string {
  const notes = {
    face: () => paparazzi.face.value.name,
    star: () => paparazzi.setup.value.celebrity.trim(),
    scene: () => sceneName(paparazzi, locale),
    seed: () => String(paparazzi.setup.value.seed)
  } as const satisfies Record<PaparazziTray, () => string>
  return notes[id]()
}

/** The one-line summary of a whole setup, for the collapsed phone sheet. */
export function setupSummary(paparazzi: PaparazziMe, locale: Locale): string {
  const setup = paparazzi.setup.value
  return pc('paparazzi.summary', locale, {
    name: setup.celebrity.trim() || '…',
    scene: sceneName(paparazzi, locale),
    resolution: setup.resolution
  })
}
