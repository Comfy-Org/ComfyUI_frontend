<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

const { prevLabel, nextLabel } = defineProps<{
  prevLabel: string
  nextLabel: string
}>()

const track = useTemplateRef<HTMLElement>('track')
const { x } = useScroll(track)

const progressPercent = computed(() => {
  const el = track.value
  if (!el) return '0%'
  const max = el.scrollWidth - el.clientWidth
  return `${(max > 0 ? x.value / max : 0) * 100}%`
})

function scroll(direction: -1 | 1) {
  const el = track.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <div
      ref="track"
      class="flex snap-x snap-mandatory scrollbar-none gap-6 overflow-x-auto"
    >
      <slot />
    </div>

    <div class="flex items-center gap-4">
      <div class="h-1 flex-1 rounded-full bg-white/20">
        <div
          class="bg-primary-comfy-yellow h-full rounded-full"
          :style="{ width: progressPercent }"
        />
      </div>

      <button
        type="button"
        :aria-label="prevLabel"
        class="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/40"
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
        :aria-label="nextLabel"
        class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-90"
        @click="scroll(1)"
      >
        <img src="/icons/arrow-right.svg" alt="" class="size-3" />
      </button>
    </div>
  </div>
</template>
