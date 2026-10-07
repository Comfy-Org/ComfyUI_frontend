<script setup lang="ts">
import { useMutationObserver, useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import CarouselArrows from '@/components/ui/carousel/CarouselArrows.vue'
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
// the cards stop overflowing and the pair goes with them.
const overflows = computed(() => !atStart.value || !atEnd.value)
const arrows = useTemplateRef<HTMLElement>('arrows')
watch(overflows, (on) => {
  if (on || !arrows.value?.contains(document.activeElement)) return
  void nextTick(() => row.value?.focus())
})
</script>

<template>
  <div class="@container">
    <div class="mb-5 flex items-center justify-between gap-4">
      <!-- The heading gives way first, so the paging pair never leaves the
        row's own width on a narrow screen. -->
      <div class="min-w-0">
        <slot name="heading" />
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <slot name="actions" />
        <!-- The same pair the home page's carousel carries, inside the row's
          own bounds rather than straddling its edge. -->
        <div v-if="overflows" ref="arrows" data-testid="card-row-arrows">
          <CarouselArrows
            :prev-label="t('workshop.sections.scrollBack')"
            :next-label="t('workshop.sections.scrollForward')"
            :at-start
            :at-end
            @prev="page(-1)"
            @next="page(1)"
          />
        </div>
      </div>
    </div>

    <ul
      ref="row"
      tabindex="-1"
      data-testid="card-row"
      class="-mx-1 scrollbar-hide flex snap-x snap-mandatory gap-5 overflow-x-auto rounded-xl px-1 pb-2 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      @scroll="measure"
    >
      <slot />
    </ul>
  </div>
</template>
