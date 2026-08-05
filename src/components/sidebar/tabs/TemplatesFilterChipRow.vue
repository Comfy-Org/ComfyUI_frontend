<script setup lang="ts">
import { useMutationObserver, useResizeObserver } from '@vueuse/core'
import { onMounted, ref } from 'vue'

/**
 * Keeps a filter's chips on a single line. Wrapping made each facet grow to
 * three rows and pushed the sheet past a scan-able height; scrolling trades
 * that vertical cost for a horizontal one the user opts into.
 */
const rowRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateAffordances() {
  const el = rowRef.value
  if (!el) return
  // 1px slack: fractional scroll offsets would otherwise leave the arrow on
  // at the very end of the track.
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollByStep(direction: 1 | -1) {
  const el = rowRef.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
}

// Chips come and go as the facet search narrows, and that changes scrollWidth
// without changing the row's own size — so watch content as well as size.
useResizeObserver(rowRef, updateAffordances)
useMutationObserver(rowRef, updateAffordances, {
  childList: true,
  subtree: true
})
onMounted(updateAffordances)

const arrowClass =
  'absolute top-1/2 z-10 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-base-background text-base-foreground shadow-sm outline-none hover:bg-secondary-background-hover'
</script>

<template>
  <div class="relative">
    <div
      ref="rowRef"
      class="flex scrollbar-hide gap-1.5 overflow-x-auto scroll-smooth"
      @scroll.passive="updateAffordances"
    >
      <slot />
    </div>

    <!-- Fade + arrow at each live edge: the fade makes a clipped chip read as
         "more this way", the arrow gives pointer users a target when there's
         no trackpad swipe. -->
    <template v-if="canScrollLeft">
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-base-background to-transparent"
      />
      <button
        type="button"
        :aria-label="$t('g.scrollLeft')"
        :class="[arrowClass, 'left-0']"
        @click="scrollByStep(-1)"
      >
        <i class="icon-[lucide--chevron-left] size-3.5" />
      </button>
    </template>

    <template v-if="canScrollRight">
      <div
        class="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-base-background to-transparent"
      />
      <button
        type="button"
        :aria-label="$t('g.scrollRight')"
        :class="[arrowClass, 'right-0']"
        @click="scrollByStep(1)"
      >
        <i class="icon-[lucide--chevron-right] size-3.5" />
      </button>
    </template>
  </div>
</template>
