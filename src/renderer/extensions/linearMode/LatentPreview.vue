<script setup lang="ts">
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'

const { executionStatusMessage } = useExecutionStatus()
</script>
<template>
  <div
    class="sz-full flex min-h-0 flex-1 flex-col items-center justify-center gap-3"
  >
    <div class="flex h-full items-center justify-center">
      <div
        class="skeleton-shimmer aspect-square size-[min(50vw,50vh)] rounded-lg"
      />
    </div>

    <span
      v-if="executionStatusMessage"
      class="animate-pulse text-sm text-muted capitalize"
    >
      {{ executionStatusMessage }}…
    </span>
  </div>
</template>
