<script setup lang="ts">
import { ChevronRight, Eye, EyeOff, Lightbulb, Sun } from '@lucide/vue'

import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import type { Light } from '@/lib/workshop/relight/lights'

const {
  light,
  selected,
  expanded,
  controls,
  locale = 'en'
} = defineProps<{
  light: Light
  selected: boolean
  expanded: boolean
  /** The id of the controls this row opens. */
  controls: string
  locale?: Locale
}>()

const emit = defineEmits<{ open: []; toggle: [] }>()

const KINDS = {
  point: { icon: Lightbulb, label: 'relight.kind.point' },
  directional: { icon: Sun, label: 'relight.kind.directional' }
} as const
const eyeLabel = computed(() =>
  lc(light.visible ? 'relight.light.hide' : 'relight.light.show', locale, {
    name: light.name
  })
)
</script>

<template>
  <div
    class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-x-2.5"
  >
    <button
      type="button"
      data-light-row
      :aria-expanded="expanded"
      :aria-controls="expanded ? controls : undefined"
      :aria-current="selected || undefined"
      :class="
        cn(
          'col-span-full row-start-1 grid h-10 grid-cols-subgrid items-center rounded-xl pr-2 pl-3 text-left text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t4 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60 focus-visible:outline-none',
          selected && 'text-primary-warm-white',
          selected && !expanded && 'bg-transparency-white-t4',
          expanded && 'hover:bg-transparent',
          !light.visible && 'text-primary-warm-gray'
        )
      "
      @click="emit('open')"
    >
      <span
        :class="
          cn(
            'size-2.5 rounded-full ring-1 ring-transparency-white-t20',
            !light.visible && 'opacity-40'
          )
        "
        :style="{ backgroundColor: light.color }"
        aria-hidden="true"
      />
      <span class="truncate text-[13px]">{{ light.name }}</span>
      <span
        :title="lc(KINDS[light.kind].label, locale)"
        :class="cn('text-primary-warm-gray', !light.visible && 'opacity-50')"
      >
        <component
          :is="KINDS[light.kind].icon"
          class="size-3.5"
          aria-hidden="true"
        />
        <span class="sr-only">{{ lc(KINDS[light.kind].label, locale) }}</span>
      </span>
      <span
        class="w-7 text-right font-mono text-xs text-primary-warm-gray tabular-nums"
        >{{ light.intensity }}</span
      >
      <span class="size-7" aria-hidden="true" />
      <ChevronRight
        :class="
          cn(
            'size-4 text-primary-warm-gray transition-transform',
            expanded && 'rotate-90'
          )
        "
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      :aria-label="eyeLabel"
      :title="eyeLabel"
      class="col-start-5 row-start-1 flex size-7 items-center justify-center rounded-full text-primary-warm-gray transition hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/60 focus-visible:outline-none"
      @click="emit('toggle')"
    >
      <Eye v-if="light.visible" class="size-3.5" aria-hidden="true" />
      <EyeOff v-else class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
