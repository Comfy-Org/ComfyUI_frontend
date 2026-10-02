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
  SPRITE_GRID,
  STYLE_LABELS
} from '../../../lib/workshop/sprite-sheet/options'
import SpriteSheetAnimation from './SpriteSheetAnimation.vue'
import SpriteSheetMotion from './SpriteSheetMotion.vue'
import SpriteSheetSeed from './SpriteSheetSeed.vue'
import SpriteSheetStyle from './SpriteSheetStyle.vue'

/**
 * The controls in order. The side panel shows the animation and the seed
 * as rows and opens style and motion as trays; the bottom composer opens
 * every one as a tray.
 */
export const SPRITE_TRAYS = [
  {
    id: 'animation',
    title: 'sprite.animation',
    content: SpriteSheetAnimation,
    compact: false,
    oneField: true
  },
  {
    id: 'style',
    title: 'sprite.style',
    content: SpriteSheetStyle,
    compact: true,
    oneField: false
  },
  {
    id: 'motion',
    title: 'sprite.motion',
    content: SpriteSheetMotion,
    compact: true,
    oneField: false
  },
  {
    id: 'seed',
    title: 'sprite.seed',
    content: SpriteSheetSeed,
    compact: false,
    oneField: true
  }
] as const satisfies readonly {
  id: SpriteTray
  title: SpriteCopyKey
  content: Component
  /** Whether a phone's chip may drop the name, the value saying enough. */
  compact: boolean
  /** Holds one field that the tray's title already names. */
  oneField: boolean
}[]

/** The current value of a control, beside its name. */
export function sectionMeta(
  id: SpriteTray,
  sprite: SpriteSheet,
  locale: Locale
): string {
  const { description, style, motion, seed } = sprite.setup.value
  if (id === 'animation')
    return description.trim() || spc('sprite.animation.none', locale)
  if (id === 'style') return spc(STYLE_LABELS[style], locale)
  if (id === 'motion') return spc(MOTION_LABELS[motion], locale)
  return String(seed)
}

/** The one-line summary of a setup, for the collapsed phone sheet. */
export function setupSummary(sprite: SpriteSheet, locale: Locale): string {
  const { style, motion } = sprite.setup.value
  return spc('sprite.summary', locale, {
    style: spc(STYLE_LABELS[style], locale),
    motion: spc(MOTION_LABELS[motion], locale),
    n: SPRITE_GRID.frames
  })
}
