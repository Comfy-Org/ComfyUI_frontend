<script setup lang="ts">
/**
 * PanelDragPreview — translucent Yves Klein blue rectangle rendered at
 * the snap-target preset's bounds while a panel is being dragged.
 * Appears above the live panel to signal where the panel will land.
 */
import { computed } from 'vue'

import type { PanelPreset } from './panelTypes'

const props = defineProps<{
  preset: PanelPreset
}>()

const presetClass = computed(() => `panel-drag-preview--${props.preset}`)
</script>

<template>
  <div
    class="panel-drag-preview"
    :class="presetClass"
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
    top var(--bento-transition-duration) var(--bento-transition-easing),
    bottom var(--bento-transition-duration) var(--bento-transition-easing),
    left var(--bento-transition-duration) var(--bento-transition-easing),
    right var(--bento-transition-duration) var(--bento-transition-easing),
    max-height var(--bento-transition-duration) var(--bento-transition-easing);
}

/* Mirror FloatingPanel's preset positions exactly so the preview lines
   up with where the panel will land. */
.panel-drag-preview--right-dock {
  top: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  bottom: var(--bento-outer-padding);
}
.panel-drag-preview--left-dock {
  top: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  left: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  bottom: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
}
.panel-drag-preview--float-tr {
  top: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
.panel-drag-preview--float-br {
  bottom: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
.panel-drag-preview--float-tl {
  top: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  left: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
.panel-drag-preview--float-bl {
  bottom: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  left: calc(
    var(--bento-outer-padding) + var(--bento-cell-size) +
      var(--bento-gutter-min)
  );
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
</style>
