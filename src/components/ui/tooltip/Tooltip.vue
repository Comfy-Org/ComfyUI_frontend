<script setup lang="ts">
import { onUnmounted, provide, ref } from 'vue'

import type { TooltipContext } from './tooltipContext'
import { TOOLTIP_KEY } from './tooltipContext'

const { delayDuration = 300 } = defineProps<{
  delayDuration?: number
}>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function scheduleOpen() {
  timer = setTimeout(() => {
    open.value = true
  }, delayDuration)
}

function close() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  open.value = false
}

onUnmounted(close)

provide<TooltipContext>(TOOLTIP_KEY, {
  open,
  triggerEl,
  delayDuration,
  scheduleOpen,
  close
})
</script>

<template>
  <slot />
</template>
