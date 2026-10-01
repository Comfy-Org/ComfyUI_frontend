<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SceneId } from '../../../lib/workshop/paparazzi-me/setup'

const { scene, src } = defineProps<{ scene: SceneId; src?: string }>()

const LOOKS = {
  'red-carpet':
    'bg-linear-to-b from-secondary-mauve/40 from-55% to-primary-comfy-red to-55%',
  'street-night':
    'bg-linear-to-b from-primary-comfy-ink via-secondary-cool-gray/30 to-primary-comfy-ink',
  cafe: 'bg-linear-to-b from-primary-comfy-orange/40 via-primary-comfy-orange/20 to-primary-comfy-ink',
  airport:
    'bg-linear-to-b from-primary-comfy-canvas via-primary-warm-gray to-secondary-cool-gray'
} as const satisfies Record<SceneId, string>
</script>

<template>
  <img v-if="src" :src alt="" class="size-full object-cover" />
  <span v-else :class="cn('block size-full', LOOKS[scene])" />
</template>
