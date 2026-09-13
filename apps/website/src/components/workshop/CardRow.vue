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
const scrollable = ref(false)

// The row carries a little padding so focus rings are not clipped, and snapping
// rests inside it, so "at the start" is a few pixels wide.
const EDGE = 8

function measure() {
  const el = row.value
  if (!el) return
  scrollable.value = el.scrollWidth > el.clientWidth + EDGE
  atStart.value = el.scrollLeft <= EDGE
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE
}

function page(direction: 1 | -1) {
  const el = row.value
  if (el)
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

// Which arrow is spent depends on the cards themselves, so the edges are
// re-read whenever they change, not only on scroll.
onMounted(() => void nextTick(measure))
useResizeObserver(row, measure)
useMutationObserver(row, measure, { childList: true, subtree: true })

const arrowClass = (spent: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 grid size-9 place-items-center rounded-full border border-transparency-white-t20 text-primary-warm-white transition-colors outline-none focus-visible:ring-3',
    spent
      ? 'cursor-default opacity-30'
      : 'hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow cursor-pointer'
  )
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between gap-4">
      <slot name="heading" />
      <div class="flex items-center gap-3">
        <slot name="actions" />
        <div v-if="scrollable" class="flex items-center gap-2">
          <button
            type="button"
            :aria-label="t('workshop.sections.scrollBack', locale)"
            :disabled="atStart"
            :class="arrowClass(atStart)"
            data-testid="card-row-prev"
            @click="page(-1)"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :aria-label="t('workshop.sections.scrollForward', locale)"
            :disabled="atEnd"
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
      class="-mx-1 flex scrollbar-hide snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2"
      @scroll="measure"
    >
      <slot />
    </ul>
  </div>
</template>
