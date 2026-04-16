<script setup lang="ts">
/**
 * OutputsCell — single bento cell that hosts the full output preview
 * surface from the current workflow.
 *
 * Phase 1: wraps the existing LinearPreview component so output
 * history, latent previews, skeletons, in-progress tracking, and
 * media-type-specific renderers all work without reimplementing.
 * Phase 2 will split outputs into their own bento cells once the
 * layout schema supports per-output positioning.
 */
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
</script>

<template>
  <div class="outputs-cell">
    <LinearPreview />
  </div>
</template>

<style scoped>
.outputs-cell {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
</style>
