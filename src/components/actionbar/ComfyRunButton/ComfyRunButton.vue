<template>
  <component :is="selectRunButton()" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import { isCloud } from '@/platform/distribution/types'

const CloudRunButtonWrapper = defineAsyncComponent(
  () => import('./CloudRunButtonWrapper.vue')
)
const ComfyQueueButton = defineAsyncComponent(
  () => import('./ComfyQueueButton.vue')
)
const LocalRunButtonWrapper = defineAsyncComponent(
  () => import('./LocalRunButtonWrapper.vue')
)

function selectRunButton() {
  if (!isCloud) return LocalRunButtonWrapper
  return window.__CONFIG__?.subscription_required
    ? CloudRunButtonWrapper
    : ComfyQueueButton
}
</script>
