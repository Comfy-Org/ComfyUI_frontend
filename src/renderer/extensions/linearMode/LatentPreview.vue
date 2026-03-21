<script setup lang="ts">
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'

const { executionStatusMessage } = useExecutionStatus()
</script>
<template>
  <div class="flex min-h-0 w-full flex-1 items-center justify-center">
    <div class="flex flex-col items-center gap-3">
      <div
        class="skeleton-shimmer aspect-square size-[min(50vw,50vh)] rounded-lg"
      />
      <span
        v-if="executionStatusMessage"
        class="animate-pulse text-sm text-muted"
      >
        {{ executionStatusMessage }}
      </span>
    </div>
  </div>
</template>
