<script setup lang="ts">
/**
 * FloatingPanel — Solution 04 panel shell. Phase 4-A: visual only, no
 * drag or resize. The preset drives absolute positioning; content lives
 * in the default slot (typically a PanelBlockList).
 */
import { computed } from 'vue'

import type { PanelPreset } from './panelTypes'

const props = withDefaults(
  defineProps<{
    preset: PanelPreset
    title?: string
    dragging?: boolean
    onHeaderPointerDown?: (e: PointerEvent) => void
  }>(),
  { title: undefined, dragging: false, onHeaderPointerDown: undefined }
)

const positionClass = computed(() => [
  `floating-panel--${props.preset}`,
  props.dragging ? 'floating-panel--dragging' : null
])
</script>

<template>
  <section class="floating-panel" :class="positionClass">
    <header
      class="floating-panel__header"
      @pointerdown="onHeaderPointerDown?.($event)"
    >
      <span class="floating-panel__drag-affordance" aria-hidden="true" />
      <span v-if="title" class="floating-panel__title">{{ title }}</span>
    </header>
    <div class="floating-panel__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="floating-panel__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.floating-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  width: var(--panel-dock-width, 420px);
  max-width: calc(100vw - var(--bento-outer-padding) * 2);
  background-color: var(--bento-color-cell-fill);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 10px;
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.4),
    0 16px 48px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(8px);
  overflow: hidden;
  z-index: 10;
  transition:
    top var(--bento-transition-duration) var(--bento-transition-easing),
    bottom var(--bento-transition-duration) var(--bento-transition-easing),
    left var(--bento-transition-duration) var(--bento-transition-easing),
    right var(--bento-transition-duration) var(--bento-transition-easing),
    max-height var(--bento-transition-duration) var(--bento-transition-easing),
    opacity var(--bento-transition-duration) var(--bento-transition-easing);
}

/* While dragging, fade the live panel so the blue preview reads as the
   destination and the panel itself reads as the thing being moved. */
.floating-panel--dragging {
  opacity: 0.55;
  transition: opacity var(--bento-transition-duration)
    var(--bento-transition-easing);
}

/* Preset positions — Phase 4-A hard-coded. Drag lands these same values. */
.floating-panel--right-dock {
  top: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  bottom: var(--bento-outer-padding);
}
/* Left-side presets: left edge clears col 1 (icons), top edge clears
   row 1 (mode toggle + action cells). This places the panel's
   top-left corner snug at the intersection of the icon column and
   the mode-toggle row. */
.floating-panel--left-dock {
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
.floating-panel--float-tr {
  top: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
.floating-panel--float-br {
  bottom: var(--bento-outer-padding);
  right: var(--bento-outer-padding);
  height: calc(50% - var(--bento-outer-padding) - 4px);
}
.floating-panel--float-tl {
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
.floating-panel--float-bl {
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

.floating-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  min-height: 32px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.floating-panel--dragging .floating-panel__header {
  cursor: grabbing;
}

.floating-panel__drag-affordance {
  display: block;
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background-color: var(--bento-color-text-muted);
  opacity: 0.35;
}

.floating-panel__title {
  font-size: var(--bento-font-md);
  color: var(--bento-color-text-muted);
}

.floating-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.floating-panel__footer {
  flex-shrink: 0;
  padding: 16px;
  border-top: 1px solid rgb(255 255 255 / 0.06);
}
</style>
