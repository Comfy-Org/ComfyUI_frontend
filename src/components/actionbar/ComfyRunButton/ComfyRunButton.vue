<template>
  <component :is="runButton" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const CloudRunButtonWrapper = defineAsyncComponent(
  () => import('./CloudRunButtonWrapper.vue')
)
const ComfyQueueButton = defineAsyncComponent(
  () => import('./ComfyQueueButton.vue')
)
const LocalRunButtonWrapper = defineAsyncComponent(
  () => import('./LocalRunButtonWrapper.vue')
)

const runButton = computed(() => {
  if (!isCloud) return LocalRunButtonWrapper
  return remoteConfig.value.subscription_required
    ? CloudRunButtonWrapper
    : ComfyQueueButton
})
</script>
