<script setup lang="ts">
import type { ToastProviderProps } from 'reka-ui'
import { ToastProvider } from 'reka-ui'

const { label, duration, disableSwipe, swipeDirection, swipeThreshold } =
  defineProps<ToastProviderProps>()
</script>

<template>
  <ToastProvider
    :label
    :duration
    :disable-swipe
    :swipe-direction
    :swipe-threshold
  >
    <slot />
  </ToastProvider>
</template>
