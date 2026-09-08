<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useMutationObserver, useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const row = useTemplateRef<HTMLElement>('row')
const atStart = ref(true)
const atEnd = ref(true)

// The row carries a little padding so focus rings are not clipped, and snapping
// rests inside it, so "at the start" is a few pixels wide.
const EDGE = 8

function measure() {
  const el = row.value
  if (!el) return
  atStart.value = el.scrollLeft <= EDGE
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE
}

function page(direction: 1 | -1) {
  const el = row.value
  if (el)
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

// The row only fades on the side that still has cards behind it, so the fade
// has to be re-read whenever the cards themselves change, not just on scroll.
onMounted(() => void nextTick(measure))
useResizeObserver(row, measure)
useMutationObserver(row, measure, { childList: true, subtree: true })

const arrowClass = (disabled: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 bg-page/70 grid size-9 place-items-center rounded-full border border-transparency-white-t20 text-primary-warm-white backdrop-blur-sm transition-colors outline-none focus-visible:ring-3',
    disabled
      ? 'cursor-not-allowed opacity-30'
      : 'hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow cursor-pointer'
  )
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between gap-4">
      <slot name="heading" />
      <div class="flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>

    <ul
      ref="row"
      class="-mx-1 flex snap-x scrollbar-thin gap-5 overflow-x-auto px-1 pb-2"
      @scroll="measure"
    >
      <slot />
    </ul>

    <!-- The link to everything sits in the heading, so the arrows take the
      other end of the row rather than crowding it. -->
    <div
      v-if="!atStart || !atEnd"
      class="mt-4 flex justify-end gap-2"
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
</template>
