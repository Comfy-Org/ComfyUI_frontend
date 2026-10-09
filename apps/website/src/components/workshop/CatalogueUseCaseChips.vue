<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { toggleIn } from '@/lib/workshop/facet-toggle'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'

const {
  options,
  label,
  locale = 'en'
} = defineProps<{
  options: readonly FacetMenuOption<T>[]
  label: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selected = defineModel<T[]>({ required: true })

function chipClass(pressed: boolean) {
  return cn(
    'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
    pressed
      ? 'bg-primary-warm-white text-primary-comfy-ink'
      : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
  )
}
</script>

<template>
  <div
    v-if="options.length"
    role="group"
    :aria-label="label"
    class="scrollbar-none flex gap-2 overflow-x-auto py-1 max-sm:-mx-6 max-sm:px-6 sm:-mx-1 sm:flex-wrap sm:overflow-visible sm:px-1"
    data-testid="catalogue-use-case-chips"
  >
    <button
      type="button"
      :aria-pressed="!selected.length"
      :class="chipClass(!selected.length)"
      data-testid="use-case-chip-all"
      @click="selected = []"
    >
      {{ t('workshop.useCase.all') }}
    </button>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="selected.includes(option.value)"
      :class="chipClass(selected.includes(option.value))"
      :data-testid="`use-case-chip-${option.value}`"
      @click="selected = toggleIn(selected, option.value)"
    >
      {{ option.label }}
      <span
        :class="
          cn(
            'tabular-nums',
            selected.includes(option.value)
              ? 'text-primary-comfy-ink/60'
              : 'text-primary-warm-gray'
          )
        "
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
