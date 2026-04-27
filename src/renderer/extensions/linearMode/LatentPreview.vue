<script setup lang="ts">
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'

const { executionStatusMessage } = useExecutionStatus()
</script>
<template>
  <!-- The shimmer fills its container so the loading state lines up
       pixel-for-pixel with the eventual finalized image — same margins,
       same outer bounds. Border matches the chrome-family hairline
       (rgb 255/255/255/0.08). The status message is absolutely
       positioned so it overlays the bottom of the shimmer instead of
       pushing the shimmer up out of the body box. -->
  <div class="relative flex size-full min-h-0 flex-1">
    <div class="skeleton-shimmer size-full rounded-lg border border-white/8" />
    <span
      v-if="executionStatusMessage"
      class="absolute bottom-3 left-1/2 -translate-x-1/2 animate-pulse text-sm text-muted"
    >
      {{ executionStatusMessage }}
    </span>
  </div>
</template>
