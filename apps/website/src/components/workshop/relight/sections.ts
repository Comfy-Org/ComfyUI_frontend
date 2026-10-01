import type { Component } from 'vue'

import type { RelightTray } from '../../../composables/useRelight'
import type { RelightCopyKey } from '../../../lib/workshop/relight/copy'
import RelightGeneration from './RelightGeneration.vue'
import RelightLights from './RelightLights.vue'
import RelightMasks from './RelightMasks.vue'
import RelightScene from './RelightScene.vue'

/** Relight's controls, as side panel sections or as the dock's trays. */
export const RELIGHT_SECTIONS = [
  { id: 'lights', title: 'relight.lights', content: RelightLights },
  { id: 'scene', title: 'relight.scene', content: RelightScene },
  { id: 'masks', title: 'relight.masks', content: RelightMasks },
  { id: 'generation', title: 'relight.generation', content: RelightGeneration }
] as const satisfies readonly {
  id: RelightTray
  title: RelightCopyKey
  content: Component
}[]
