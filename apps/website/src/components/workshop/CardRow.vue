<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useResizeObserver } from '@vueuse/core'
import { onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const row = useTemplateRef<HTMLElement>('row')
const atStart = ref(true)
const atEnd = ref(true)

function measure() {
  const el = row.value
  if (!el) return
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

function page(direction: 1 | -1) {
  const el = row.value
  if (el)
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

onMounted(measure)
useResizeObserver(row, measure)

const arrowClass = (disabled: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 grid size-9 place-items-center rounded-full border border-transparency-white-t20 text-primary-warm-white transition-colors outline-none focus-visible:ring-3',
    disabled
      ? 'cursor-not-allowed opacity-30'
      : 'hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow cursor-pointer'
  )
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between gap-4">
      <slot name="heading" />
      <div class="flex shrink-0 items-center gap-3">
        <slot name="actions" />
        <div
          v-if="!atStart || !atEnd"
          class="flex gap-2"
          data-testid="card-row-arrows"
        >
          <button
            type="button"
            :disabled="atStart"
            :aria-label="t('workshop.sections.scrollBack', locale)"
            :class="arrowClass(atStart)"
            data-testid="card-row-prev"
            @click="page(-1)"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :disabled="atEnd"
            :aria-label="t('workshop.sections.scrollForward', locale)"
            :class="arrowClass(atEnd)"
            data-testid="card-row-next"
            @click="page(1)"
          >
            <ChevronRight class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <ul
      ref="row"
      :class="
        cn(
          '-mx-1 flex snap-x scrollbar-thin gap-5 overflow-x-auto px-1 pb-2',
          !atStart && 'mask-l-from-92%',
          !atEnd && 'mask-r-from-92%'
        )
      "
      @scroll="measure"
    >
      <slot />
    </ul>
  </div>
</template>
