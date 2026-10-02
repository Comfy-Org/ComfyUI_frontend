<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import CinematicCheckBadge from '../cinematic-studio/CinematicCheckBadge.vue'

const { src, label, checked } = defineProps<{
  src: string
  label: string
  checked: boolean
}>()

const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="checked"
    class="group flex min-w-0 flex-col gap-1.5 text-left focus-visible:outline-none"
    @click="emit('pick')"
  >
    <span
      :class="
        cn(
          'relative flex aspect-3/2 w-full overflow-hidden rounded-xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8 transition-shadow group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
          checked &&
            'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
        )
      "
    >
      <img :src alt="" loading="lazy" class="size-full object-cover" />
      <CinematicCheckBadge v-if="checked" />
    </span>
    <span
      class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
    >
      {{ label }}
    </span>
  </button>
</template>
