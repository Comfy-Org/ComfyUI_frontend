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
// Rows are not all the same height: a card carrying three tags stands taller
// than one carrying a single tag. Centring on the row would put each row's
// arrows at a different point of its cards, so they centre on the artwork.
const arrowTop = ref('50%')

// The row carries a little padding so focus rings are not clipped, and snapping
// rests inside it, so "at the start" is a few pixels wide.
const EDGE = 8

function measure() {
  const el = row.value
  if (!el) return
  atStart.value = el.scrollLeft <= EDGE
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE

  const art = el.querySelector('li img, li video')
  if (!art) return
  const { top, height } = art.getBoundingClientRect()
  arrowTop.value = `${Math.round(top - el.getBoundingClientRect().top + height / 2)}px`
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

// The arrows ride over the row rather than under it: a strip of their own
// would put a band of empty page between every two sliders. They are opaque,
// because a card showing through a control reads as a rendering fault.
const arrowClass =
  'focus-visible:ring-primary-comfy-yellow/50 hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow bg-page pointer-events-auto absolute z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-transparency-white-t20 text-primary-warm-white shadow-lg shadow-black/40 transition-colors outline-none focus-visible:ring-3'

// The fade says there is more that way, so it keeps the arrows' company: each
// side carries one only while that side has somewhere to go.
const fadeClass =
  'pointer-events-none absolute inset-y-0 z-0 w-20 from-page via-page/70 to-transparent'
</script>

<template>
  <div>
    <div class="mb-5 flex items-baseline justify-between gap-4">
      <slot name="heading" />
      <div class="flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>

    <div class="relative">
      <ul
        ref="row"
        class="-mx-1 flex scrollbar-hide snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2"
        @scroll="measure"
      >
        <slot />
      </ul>

      <!-- An arrow is only there while it has somewhere to go, so the row
        never carries a control it cannot honour. -->
      <div
        v-if="!atStart || !atEnd"
        class="pointer-events-none absolute inset-0"
        data-testid="card-row-arrows"
      >
        <template v-if="!atStart">
          <span
            :class="cn(fadeClass, 'left-0 bg-linear-to-r')"
            aria-hidden="true"
          />
          <button
            type="button"
            :aria-label="t('workshop.sections.scrollBack', locale)"
            :class="cn(arrowClass, '-left-1')"
            :style="{ top: arrowTop }"
            data-testid="card-row-prev"
            @click="page(-1)"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </button>
        </template>
        <template v-if="!atEnd">
          <span
            :class="cn(fadeClass, 'right-0 bg-linear-to-l')"
            aria-hidden="true"
          />
          <button
            type="button"
            :aria-label="t('workshop.sections.scrollForward', locale)"
            :class="cn(arrowClass, '-right-1')"
            :style="{ top: arrowTop }"
            data-testid="card-row-next"
            @click="page(1)"
          >
            <ChevronRight class="size-4" aria-hidden="true" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
