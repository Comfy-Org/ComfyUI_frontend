<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import CinematicCheckBadge from '@/components/workshop/cinematic-studio/CinematicCheckBadge.vue'
import type { TileAspect } from './tile-classes'
import { TILE_ASPECT, tileCaption } from './tile-classes'

const { label, src, checked, aspect, large } = defineProps<{
  label: string
  src?: string
  checked: boolean
  aspect: TileAspect
  /** Marks the picked tile with a check, for big tiles. */
  large: boolean
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
          'relative block w-full overflow-hidden rounded-lg ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
          TILE_ASPECT[aspect],
          checked &&
            'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
        )
      "
    >
      <slot>
        <img
          v-if="src"
          :src
          alt=""
          loading="lazy"
          class="size-full object-cover"
        />
      </slot>
      <CinematicCheckBadge v-if="large && checked" />
    </span>
    <span
      :class="
        cn(
          'truncate text-primary-warm-gray group-hover:text-primary-comfy-canvas',
          tileCaption(large),
          checked && 'text-primary-warm-white'
        )
      "
      >{{ label }}</span
    >
  </button>
</template>
