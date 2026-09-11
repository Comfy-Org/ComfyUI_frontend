<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useSlidingUnderline } from '../../composables/useSlidingUnderline'
import type { UseCase } from '../../config/models-catalogue'

type Entry = { value: UseCase | 'all'; label: string }

const {
  entries,
  current,
  label,
  railBeside = false
} = defineProps<{
  entries: readonly Entry[]
  current: UseCase | 'all'
  label: string
  railBeside?: boolean
}>()

const emit = defineEmits<{ select: [value: UseCase | 'all'] }>()

const navRef = useTemplateRef<HTMLElement>('nav')
const underline = useSlidingUnderline(navRef, () => [current, entries])
</script>

<template>
  <nav
    ref="nav"
    :class="
      cn(
        'relative flex scrollbar-thin gap-6 overflow-x-auto border-b border-white/10',
        railBeside && 'lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0'
      )
    "
    :aria-label="label"
    data-testid="hub-use-cases"
  >
    <span
      aria-hidden="true"
      :class="
        cn(
          'pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary-warm-white transition-[translate,width] duration-300 ease-out',
          railBeside && 'lg:hidden'
        )
      "
      :style="{
        width: `${underline.width}px`,
        translate: `${underline.left}px 0`
      }"
    />
    <button
      v-for="entry in entries"
      :key="entry.value"
      type="button"
      :aria-pressed="current === entry.value"
      :data-testid="`hub-use-case-${entry.value}`"
      :class="
        cn(
          'flex shrink-0 cursor-pointer items-baseline gap-1.5 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
          railBeside && 'lg:w-full lg:rounded-xl lg:px-3 lg:py-2.5',
          current === entry.value
            ? cn(
                'text-primary-warm-white',
                railBeside && 'lg:bg-transparency-white-t8'
              )
            : cn(
                'text-content-muted hover:text-content',
                railBeside && 'lg:hover:bg-transparency-white-t4'
              )
        )
      "
      @click="emit('select', entry.value)"
    >
      <span class="min-w-0 truncate">{{ entry.label }}</span>
    </button>
  </nav>
</template>
