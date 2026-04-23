<script setup lang="ts">
/**
 * ProgressCell — horizontal go-green progress bar that fills the cell
 * left-to-right while the queue runs. Gated on `activeJobsCount > 0`
 * by AppChrome so it only occupies space when something's running.
 *
 * Visually matches RunCell (green-500 / green-600) so "running" reads
 * as the same semantic as "go" at a glance — one saturated
 * bauhaus-primary color shared across the go/progress family.
 *
 * Progress math: naive `nodesExecuted / totalNodes` is a step
 * function that sits frozen through the longest-running node
 * (typically KSampler, ~90% of wall-clock time in a diffusion
 * workflow), then jumps at the end. Blending in the executing
 * node's internal step progress fills the gap so the bar actually
 * moves during the phase that takes the most time:
 *   ( completed + executingNodeProgress ) / totalNodes
 */
import { computed } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'

const executionStore = useExecutionStore()

const progressPercent = computed(() => {
  const total = executionStore.totalNodesToExecute
  if (total <= 0) return 0
  const completed = executionStore.nodesExecuted ?? 0
  const inFlight = executionStore.executingNodeProgress ?? 0
  const pct = ((completed + inFlight) / total) * 100
  return Math.max(0, Math.min(100, pct))
})
</script>

<template>
  <!-- Outer wrapper provides breathing room inside the chrome cell so
       the track reads as its own component rather than a bleed-to-edge
       fill of the cell. Inner track is the semantic progressbar. -->
  <div class="size-full p-2">
    <div
      class="relative size-full overflow-hidden rounded-md border border-gray-400 bg-black/40"
      role="progressbar"
      :aria-valuenow="progressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="absolute inset-y-0 left-0 bg-green-500 transition-[width] duration-300 ease-out"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
  </div>
</template>
