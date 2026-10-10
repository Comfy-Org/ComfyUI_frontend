<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useMutationObserver, useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

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
  if (direction === -1 ? atStart.value : atEnd.value) return
  if (el)
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

// Which arrow is spent depends on the cards themselves, so the edges are
// re-read whenever they change, not only on scroll.
onMounted(() => void nextTick(measure))
useResizeObserver(row, measure)
useMutationObserver(row, measure, { childList: true, subtree: true })

// Both ends resting means there is nothing to page, so the row carries no
// control it cannot honour. Paging to one end only dims that arrow, so the
// reader standing on it keeps their place; the row itself takes the focus when
// the cards stop overflowing and the arrows go with them.
const overflows = computed(() => !atStart.value || !atEnd.value)
const arrows = useTemplateRef<HTMLElement>('arrows')
watch(overflows, (on) => {
  if (on || !arrows.value?.contains(document.activeElement)) return
  void nextTick(() => row.value?.focus())
})

// The arrows straddle the edge of the row, half over the cards and half over
// the page, so the row reads as running past them. They are opaque, because a
// card showing through a control reads as a rendering fault. Hovering lifts
// them without colour: the yellow belongs to See all, and two yellows on one
// row compete.
const arrowClass =
  'focus-visible:ring-primary-comfy-yellow/50 hover:border-primary-warm-gray hover:bg-site-dropdown bg-page pointer-events-auto absolute top-1/2 z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-xl border border-transparency-white-t20 text-primary-warm-white shadow-lg shadow-black/40 transition-colors outline-none focus-visible:ring-3 aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:border-transparency-white-t20 aria-disabled:hover:bg-page'

// A pointer that can hover earns them by hovering, so a page of rows is not a
// page of chrome, and a keyboard earns them by focusing. A touch screen can do
// neither, so there they stay.
const revealClass =
  'pointer-events-none absolute -inset-x-1 top-0 bottom-2 transition-opacity duration-200 can-hover:opacity-0 can-hover:group-hover/row:opacity-100 can-hover:group-focus-within/row:opacity-100'
</script>

<template>
  <div class="@container">
    <div class="mb-5 flex items-baseline justify-between gap-4">
      <slot name="heading" />
      <div class="flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>

    <div class="group/row relative">
      <ul
        ref="row"
        tabindex="-1"
        data-testid="card-row"
        class="-mx-1 scrollbar-hide flex snap-x snap-mandatory gap-5 overflow-x-auto rounded-xl px-1 pb-2 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        @scroll="measure"
      >
        <slot />
      </ul>

      <div
        v-if="overflows"
        ref="arrows"
        :class="revealClass"
        data-testid="card-row-arrows"
      >
        <button
          type="button"
          :aria-label="t('workshop.sections.scrollBack')"
          :aria-disabled="atStart || undefined"
          :class="cn(arrowClass, 'left-0 -translate-x-1/2')"
          data-testid="card-row-prev"
          @click="page(-1)"
        >
          <ChevronLeft class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="t('workshop.sections.scrollForward')"
          :aria-disabled="atEnd || undefined"
          :class="cn(arrowClass, 'right-0 translate-x-1/2')"
          data-testid="card-row-next"
          @click="page(1)"
        >
          <ChevronRight class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
