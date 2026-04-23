<script setup lang="ts">
/**
 * BuilderBackdrop — dot-grid canvas + LinearPreview backdrop for the
 * builder's Preview step. Mirrors LayoutView's backdrop exactly so the
 * Preview visually reads as App Mode: dot-grid canvas color behind,
 * LinearPreview in front (which internally shows LinearArrange's dashed
 * output-area marker in arrange mode, or the actual output when run).
 *
 * Mounts only in the arrange step: during Inputs / Outputs the user
 * clicks on graph-canvas nodes, so the graph has to stay visible.
 * In arrange (Preview), graph interaction isn't meaningful — this
 * backdrop replaces the graph canvas so authors see a clean
 * App-Mode-style preview of where their outputs and inputs will sit.
 */
import { useAppMode } from '@/composables/useAppMode'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'

const { isArrangeMode } = useAppMode()
</script>

<template>
  <div v-if="isArrangeMode" class="builder-backdrop">
    <LinearPreview hide-chrome />
  </div>
</template>

<style scoped>
/* Same background treatment as LayoutView's .layout-view so the Preview
   reads as App Mode. Sits between the graph canvas (below) and the
   chrome / panel layers (above). z-index chosen to cover the canvas
   but sit under AppChrome (90), FloatingPanel (100), BuilderToolbar,
   and BuilderFooterToolbar. */
.builder-backdrop {
  position: fixed;
  top: var(--workflow-tabs-height);
  /* Offset past the sidebar icon strip so the Comfy sidebar stays
     visible and interactive during arrange. The expanded sidebar panel
     (if a tab is active) will sit under this backdrop — acceptable
     during arrange since focus is on the layout preview, not
     sidebar contents. */
  left: var(--sidebar-width, 0);
  right: 0;
  bottom: 0;
  z-index: 50;
  background-color: var(--color-layout-canvas);
  background-image: radial-gradient(
    circle,
    var(--color-layout-grid-dot) 1px,
    transparent 1.5px
  );
  background-size: var(--spacing-layout-dot) var(--spacing-layout-dot);
  background-position: 0 0;
  overflow: hidden;
  pointer-events: none;
}

/* Re-enable pointer events on LinearPreview so its own interactions
   (if any — LinearArrange has clickable zones) still register.
   Descendants opt in; the root stays passthrough so chrome clicks
   aren't swallowed. */
.builder-backdrop :deep(*) {
  pointer-events: auto;
}
</style>
