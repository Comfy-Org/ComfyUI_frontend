<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useScroll } from '@vueuse/core'
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'

import { t } from '../../../i18n/translations'
import type { Locale } from '../../../i18n/translations'

const {
  locale = 'en',
  gapClass = 'gap-12 lg:gap-20',
  class: className
} = defineProps<{
  locale?: Locale
  gapClass?: string
  class?: HTMLAttributes['class']
}>()

const trackRef = ref<HTMLElement>()
const { x } = useScroll(trackRef)

const progress = computed(() => {
  const el = trackRef.value
  if (!el) return 0
  const max = el.scrollWidth - el.clientWidth
  return max > 0 ? x.value / max : 0
})

function scroll(direction: -1 | 1) {
  const el = trackRef.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
}

const progressPercent = computed(() => `${progress.value * 100}%`)
</script>

<template>
  <section
    :class="cn('max-w-9xl mx-auto px-6 py-16 lg:px-16 lg:py-24', className)"
  >
    <div
      ref="trackRef"
      :class="
        cn(
          'flex snap-x snap-mandatory scrollbar-none overflow-x-auto',
          gapClass
        )
      "
    >
      <slot />
    </div>

    <div class="mt-10 flex items-center gap-4">
      <div class="h-1 flex-1 rounded-full bg-white/20" aria-hidden="true">
        <div
          class="bg-primary-comfy-yellow h-full rounded-full"
          :style="{ width: progressPercent }"
        />
      </div>

      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/40"
        :aria-label="t('carousel.previous', locale)"
        @click="scroll(-1)"
      >
        <img
          src="/icons/arrow-right.svg"
          alt=""
          class="size-3 rotate-180 opacity-60 invert"
        />
      </button>

      <button
        type="button"
        class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-90"
        :aria-label="t('carousel.next', locale)"
        @click="scroll(1)"
      >
        <img src="/icons/arrow-right.svg" alt="" class="size-3" />
      </button>
    </div>
  </section>
</template>
