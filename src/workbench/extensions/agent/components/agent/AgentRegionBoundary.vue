<template>
  <slot v-if="!failed" />
  <slot v-else name="fallback" />
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

const { region } = defineProps<{
  region: string
}>()

const failed = ref(false)

onErrorCaptured((error, _instance, info) => {
  if (!failed.value) {
    failed.value = true
    reportError(error, {
      surface: 'agent',
      errorType: 'error_rendering_agent_region',
      tags: { region },
      context: { info }
    })
  }
  return false
})
</script>
