import type { Component } from 'vue'

import type { Relight, RelightTray } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import type { RelightCopyKey } from '@/lib/workshop/relight/copy'
import { lc } from '@/lib/workshop/relight/copy'
import { MAX_LIGHTS, MOOD_LABELS } from '@/lib/workshop/relight/lights'
import type { ShadowStyle } from '@/lib/workshop/relight/shadows'
import RelightGeneration from './RelightGeneration.vue'
import RelightLights from './RelightLights.vue'
import RelightMasks from './RelightMasks.vue'
import RelightMood from './RelightMood.vue'
import RelightScene from './RelightScene.vue'
import RelightShadows from './RelightShadows.vue'

/**
 * Relight's controls in panel order. In the side panel each is a
 * collapsible section; in the bottom composer each opens in `tray`.
 */
export const RELIGHT_SECTIONS = [
  {
    id: 'mood',
    title: 'relight.mood',
    content: RelightMood,
    open: true,
    tray: 'mood'
  },
  {
    id: 'lights',
    title: 'relight.lights',
    content: RelightLights,
    open: true,
    tray: 'lights'
  },
  {
    id: 'shadows',
    title: 'relight.shadows',
    content: RelightShadows,
    open: false,
    tray: 'shadows'
  },
  {
    id: 'scene',
    title: 'relight.scene',
    content: RelightScene,
    open: false,
    tray: 'mood'
  },
  {
    id: 'masks',
    title: 'relight.masks',
    content: RelightMasks,
    open: false,
    tray: 'masks'
  },
  {
    id: 'generation',
    title: 'relight.generation',
    content: RelightGeneration,
    open: false,
    tray: 'generation'
  }
] as const satisfies readonly {
  id: string
  title: RelightCopyKey
  content: Component
  open: boolean
  tray: RelightTray
}[]

export const RELIGHT_TRAYS = [
  { id: 'mood', title: 'relight.mood' },
  { id: 'lights', title: 'relight.lights' },
  { id: 'shadows', title: 'relight.shadows' },
  { id: 'masks', title: 'relight.masks' },
  { id: 'generation', title: 'relight.generation' }
] as const satisfies readonly { id: RelightTray; title: RelightCopyKey }[]

const SHADOW_LABELS = {
  none: 'relight.shadows.none',
  soft: 'relight.shadows.soft',
  hard: 'relight.shadows.hard',
  long: 'relight.shadows.long'
} as const satisfies Record<ShadowStyle, RelightCopyKey>

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: string,
  relight: Relight,
  locale: Locale
): string | undefined {
  const { setup, lights, shadows } = relight
  const notes: Partial<Record<string, () => string>> = {
    mood: () => lc(MOOD_LABELS[setup.value.mood], locale),
    lights: () =>
      lc('relight.lights.count', locale, {
        n: lights.value.length,
        max: MAX_LIGHTS
      }),
    shadows: () => lc(SHADOW_LABELS[shadows.value], locale),
    scene: () =>
      lc('relight.scene.summary', locale, { n: setup.value.scene.ambient }),
    masks: () => String(setup.value.masks.length),
    generation: () =>
      lc('relight.generation.value', locale, {
        n: setup.value.generation.strength
      })
  }
  return notes[id]?.()
}

/** The one-line summary of a whole setup, for the collapsed phone sheet. */
export function setupSummary(relight: Relight, locale: Locale): string {
  const { setup, lights, shadows } = relight
  return lc('relight.summary', locale, {
    mood: lc(MOOD_LABELS[setup.value.mood], locale),
    n: lights.value.length,
    shadows: lc(SHADOW_LABELS[shadows.value], locale)
  })
}
