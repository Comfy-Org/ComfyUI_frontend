import type { Component } from 'vue'

import type {
  SpriteSheet,
  SpriteTray
} from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import type { SpriteCopyKey } from '../../../lib/workshop/sprite-sheet/copy'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import {
  MOTION_LABELS,
  STYLE_LABELS
} from '../../../lib/workshop/sprite-sheet/options'
import SpriteSheetAdvanced from './SpriteSheetAdvanced.vue'
import SpriteSheetMotion from './SpriteSheetMotion.vue'
import SpriteSheetStyle from './SpriteSheetStyle.vue'

/**
 * The controls in panel order. In the side panel each is a collapsible
 * section; in the bottom composer each opens as a tray.
 */
export const SPRITE_SECTIONS = [
  { id: 'style', title: 'sprite.style', content: SpriteSheetStyle, open: true },
  {
    id: 'motion',
    title: 'sprite.motion',
    content: SpriteSheetMotion,
    open: true
  },
  {
    id: 'advanced',
    title: 'sprite.advanced',
    content: SpriteSheetAdvanced,
    open: false
  }
] as const satisfies readonly {
  id: SpriteTray
  title: SpriteCopyKey
  content: Component
  open: boolean
}[]

/** The current value beside a section's title, so a closed one says it. */
export function sectionMeta(
  id: SpriteTray,
  sprite: SpriteSheet,
  locale: Locale
): string {
  const { style, motion, frames, seed } = sprite.setup.value
  if (id === 'style') return spc(STYLE_LABELS[style], locale)
  if (id === 'motion') return spc(MOTION_LABELS[motion], locale)
  return spc('sprite.advanced.summary', locale, { n: frames, seed })
}

/** The one-line summary of a setup, for the collapsed phone sheet. */
export function setupSummary(sprite: SpriteSheet, locale: Locale): string {
  const { style, motion, frames } = sprite.setup.value
  return spc('sprite.summary', locale, {
    style: spc(STYLE_LABELS[style], locale),
    motion: spc(MOTION_LABELS[motion], locale),
    n: frames
  })
}
