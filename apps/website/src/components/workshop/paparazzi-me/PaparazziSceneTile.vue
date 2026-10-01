<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { SceneId } from '../../../lib/workshop/paparazzi-me/setup'
import PaparazziSceneArt from './PaparazziSceneArt.vue'

const { scene, src, label, checked, dimmed } = defineProps<{
  scene: SceneId
  src?: string
  label: string
  checked: boolean
  dimmed: boolean
}>()

const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="checked"
    class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
    @click="emit('pick')"
  >
    <span
      :class="
        cn(
          'relative block aspect-video w-full overflow-hidden rounded-lg ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
          checked &&
            'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white',
          dimmed && 'opacity-50'
        )
      "
    >
      <PaparazziSceneArt :scene :src />
    </span>
    <span
      :class="
        cn(
          'truncate text-xs text-primary-warm-gray group-hover:text-primary-comfy-canvas',
          checked && 'text-primary-warm-white'
        )
      "
      >{{ label }}</span
    >
  </button>
</template>
