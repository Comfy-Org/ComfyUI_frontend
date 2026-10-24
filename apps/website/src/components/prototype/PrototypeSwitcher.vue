<script setup lang="ts">
// PROTOTYPE — floating variant switcher bar. Not part of the design under
// review. Shown in all builds: it only ever mounts on the throwaway
// /learning-prototype route, which is deleted once a variant wins.
import { onMounted, onUnmounted } from 'vue'

interface PrototypeVariant {
  key: string
  name: string
}

const { variants, current } = defineProps<{
  variants: PrototypeVariant[]
  current: string
}>()

const emit = defineEmits<{
  'update:current': [key: string]
}>()

const currentIndex = () =>
  Math.max(
    0,
    variants.findIndex((variant) => variant.key === current)
  )

const cycle = (direction: 1 | -1) => {
  const next = (currentIndex() + direction + variants.length) % variants.length
  emit('update:current', variants[next].key)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return
  }
  if (event.key === 'ArrowLeft') cycle(-1)
  if (event.key === 'ArrowRight') cycle(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="bg-primary-comfy-yellow fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-primary-comfy-ink py-1.5 pr-4 pl-1.5 text-primary-comfy-ink shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
  >
    <button
      type="button"
      aria-label="Previous variant"
      class="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary-comfy-ink/10"
      @click="cycle(-1)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <polyline points="15 6 9 12 15 18" />
      </svg>
    </button>

    <span class="text-xs font-bold tracking-wide uppercase select-none">
      Prototype {{ current.toUpperCase() }} —
      {{ variants[currentIndex()].name }}
    </span>

    <button
      type="button"
      aria-label="Next variant"
      class="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary-comfy-ink/10"
      @click="cycle(1)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </button>
  </div>
</template>
