import type { Component } from 'vue'

import type { RelightTray } from '../../../composables/useRelight'
import type { RelightCopyKey } from '../../../lib/workshop/relight/copy'
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
    open: true,
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
