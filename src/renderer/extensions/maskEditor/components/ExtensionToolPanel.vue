<template>
  <div ref="container" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { createMaskEditorToolSession } from '@/renderer/extensions/maskEditor/composables/maskEditorToolSession'

const { runtime } = defineProps<{
  runtime: ReturnType<typeof createMaskEditorToolSession>
}>()
const container = ref<HTMLDivElement>()

watch(
  [container, () => runtime],
  ([element, session], _, onCleanup) => {
    if (!element) return
    const cleanup = session.mountPanel(element)
    if (cleanup) onCleanup(cleanup)
  },
  { flush: 'post', immediate: true }
)
</script>
