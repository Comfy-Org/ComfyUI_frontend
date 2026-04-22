<script setup lang="ts">
/**
 * PanelDragPreview — translucent Yves Klein blue rectangle rendered at
 * the snap-target preset's bounds while a panel is being dragged.
 * Appears above the live panel to signal where the panel will land.
 *
 * Passing `panelHeight` makes the preview match the live panel's
 * content-fit height instead of stretching to the preset's full
 * `max-height`. Each preset's CSS `max-height` still caps the preview
 * on small viewports.
 */
import { computed } from 'vue'

import type { PanelPreset } from './panelTypes'

const props = defineProps<{
  preset: PanelPreset
  panelHeight?: number
}>()

const presetClass = computed(() => `panel-drag-preview--${props.preset}`)
const heightStyle = computed(() =>
  props.panelHeight != null ? { height: `${props.panelHeight}px` } : undefined
)
</script>

<template>
  <div
    class="panel-drag-preview"
    :class="presetClass"
    :style="heightStyle"
    aria-hidden="true"
    data-testid="panel-drag-preview"
  />
</template>

<style scoped>
.panel-drag-preview {
  position: absolute;
  width: var(--panel-dock-width, 420px);
  /* Comfy brand blue — vivid to match the logo. */
  background-color: rgb(30 64 255 / 0.3);
  border: 2px solid #1e40ff;
  border-radius: 10px;
  pointer-events: none;
  z-index: 20;
  transition:
    top var(--duration-layout) var(--ease-layout),
    bottom var(--duration-layout) var(--ease-layout),
    left var(--duration-layout) var(--ease-layout),
    right var(--duration-layout) var(--ease-layout),
    max-height var(--duration-layout) var(--ease-layout);
}

/* Mirror FloatingPanel's preset positions. Height comes from the
   inline `panelHeight` prop so the preview shrinks to match the live
   panel's content-fit size; each preset's `max-height` still caps it
   on short viewports. */
.panel-drag-preview--right-dock {
  top: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) +
      var(--spacing-layout-gutter)
  );
  right: var(--spacing-layout-outer);
  max-height: calc(
    100% - var(--spacing-layout-outer) * 2 - var(--spacing-layout-cell) -
      var(--spacing-layout-gutter)
  );
}
.panel-drag-preview--left-dock {
  top: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) +
      var(--spacing-layout-gutter)
  );
  left: var(--spacing-layout-outer);
  max-height: calc(
    100% - var(--spacing-layout-outer) * 2 - var(--spacing-layout-cell) * 2 -
      var(--spacing-layout-gutter) * 2
  );
}
.panel-drag-preview--float-tr {
  top: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) +
      var(--spacing-layout-gutter)
  );
  right: var(--spacing-layout-outer);
  max-height: calc(50% - var(--spacing-layout-outer) - 4px);
}
.panel-drag-preview--float-br {
  bottom: var(--spacing-layout-outer);
  right: var(--spacing-layout-outer);
  max-height: calc(50% - var(--spacing-layout-outer) - 4px);
}
.panel-drag-preview--float-tl {
  top: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) +
      var(--spacing-layout-gutter)
  );
  left: var(--spacing-layout-outer);
  max-height: calc(50% - var(--spacing-layout-outer) - 4px);
}
.panel-drag-preview--float-bl {
  bottom: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) +
      var(--spacing-layout-gutter)
  );
  left: var(--spacing-layout-outer);
  max-height: calc(50% - var(--spacing-layout-outer) - 4px);
}
</style>
