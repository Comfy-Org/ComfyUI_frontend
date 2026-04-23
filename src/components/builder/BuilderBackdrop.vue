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
  <!-- Same dot-grid + canvas-color treatment LayoutView uses so Preview
       reads as App Mode. Sits between the graph canvas (below) and the
       chrome / panel layers (above): z-50 covers the canvas but sits
       under AppChrome (z-1/90), FloatingPanel (z-100), BuilderToolbar
       and BuilderFooterToolbar. Sidebar-width offset keeps the Comfy
       sidebar icon strip visible during arrange. Pointer-events-none
       on the root lets chrome / graph clicks fall through empty space;
       see the :deep() exception below for the descendant override. -->
  <div
    v-if="isArrangeMode"
    class="builder-backdrop pointer-events-none fixed top-(--workflow-tabs-height) right-0 bottom-0 left-(--sidebar-width,0px) z-50 overflow-hidden bg-layout-canvas bg-[radial-gradient(circle,var(--color-layout-grid-dot)_1px,transparent_1.5px)] bg-size-[var(--spacing-layout-dot)_var(--spacing-layout-dot)] bg-position-[0_0]"
  >
    <LinearPreview hide-chrome />
  </div>
</template>

<!-- Exception (docs/guidance/vue-components.md §Styling): :deep(*) is
     the only practical way to re-enable pointer events on the slotted
     <LinearPreview> subtree. The root is pointer-events-none so graph/
     chrome clicks fall through empty builder-backdrop space; slotted
     content needs pointer-events-auto so LinearArrange's clickable
     zones still register. We don't own LinearPreview's render tree, so
     we can't push the rule into that component's template. -->
<style scoped>
.builder-backdrop :deep(*) {
  pointer-events: auto;
}
</style>
