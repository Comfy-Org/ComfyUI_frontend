<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'

const {
  columns,
  rows,
  count,
  current,
  locale = 'en'
} = defineProps<{
  columns: number
  rows: number
  count: number
  /** The frame the preview shows, ringed. */
  current: number
  locale?: Locale
}>()

const emit = defineEmits<{ show: [index: number] }>()
</script>

<template>
  <div
    class="absolute inset-0 grid"
    :style="{
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`
    }"
  >
    <button
      v-for="index in count"
      :key="index"
      type="button"
      :aria-label="spc('sprite.frame.show', locale, { n: index })"
      :aria-pressed="current === index - 1"
      :class="
        cn(
          'group relative outline outline-transparency-white-t8 transition hover:bg-transparency-white-t4 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60 focus-visible:outline-none',
          current === index - 1 &&
            'z-10 rounded-sm ring-2 ring-primary-warm-white/80 ring-inset'
        )
      "
      @click="emit('show', index - 1)"
    >
      <span
        :class="
          cn(
            'absolute top-1.5 left-2 font-mono text-[10px] text-primary-warm-gray/70 tabular-nums',
            current === index - 1 && 'text-primary-warm-white'
          )
        "
        aria-hidden="true"
        >{{ index }}</span
      >
    </button>
  </div>
</template>
