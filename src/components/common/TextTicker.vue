<template>
  <div
    ref="containerRef"
    :class="
      cn('overflow-hidden whitespace-nowrap', !isScrolling && 'text-ellipsis')
    "
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { speed = 80 } = defineProps<{
  /** Scroll speed in pixels per second */
  speed?: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const isHovered = useElementHover(containerRef)
const isScrolling = ref(false)
let animationId: number | null = null

function startScroll() {
  const el = containerRef.value
  if (!el) return

  const overflow = el.scrollWidth - el.clientWidth
  if (overflow <= 0) return

  isScrolling.value = true
  const duration = (overflow / speed) * 1000
  const startTime = performance.now()

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    el!.scrollLeft = overflow * progress

    if (progress < 1) {
      animationId = requestAnimationFrame(animate)
    }
  }

  animationId = requestAnimationFrame(animate)
}

function stopScroll() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  if (containerRef.value) {
    containerRef.value.scrollLeft = 0
  }
  isScrolling.value = false
}

watch(isHovered, (hovered) => {
  if (hovered) startScroll()
  else stopScroll()
})

onBeforeUnmount(stopScroll)
</script>
