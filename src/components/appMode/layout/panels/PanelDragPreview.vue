<script setup lang="ts">
/**
 * PanelDragPreview — translucent brand-blue rectangle rendered at the
 * snap-target preset's bounds while a panel is being dragged. Appears
 * above the live panel to signal where the panel will land on release.
 *
 * Passing `panelHeight` makes the preview match the live panel's
 * content-fit height instead of stretching to the preset's full
 * `max-height`; each preset's `max-height` still caps the preview on
 * small viewports.
 */
import { computed } from 'vue'

import type { PanelPreset } from './panelTypes'

const props = defineProps<{
  preset: PanelPreset
  panelHeight?: number
}>()

// Mirror FloatingPanel's preset positions. Dock presets use a fixed
// `height` so the preview reads as a full-height landing zone; float
// presets stay content-driven via `max-height`. Keep these in sync
// with FloatingPanel's PRESET_CLASSES — otherwise the preview
// wouldn't match where the live panel lands. The CSS calc()
// expressions stay verbatim as arbitrary Tailwind values since they
// don't translate to a single token.
const PRESET_CLASSES: Record<PanelPreset, string> = {
  'right-dock':
    'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))] right-(--spacing-layout-outer) h-[calc(100%-var(--spacing-layout-outer)*2-var(--spacing-layout-cell)-var(--spacing-layout-gutter))]',
  'left-dock':
    'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))] left-(--spacing-layout-outer) h-[calc(100%-var(--spacing-layout-outer)*2-var(--spacing-layout-cell)*2-var(--spacing-layout-gutter)*2)]',
  'float-tr':
    'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))] right-(--spacing-layout-outer) max-h-[calc(50%-var(--spacing-layout-outer)-4px)]',
  'float-br':
    'bottom-(--spacing-layout-outer) right-(--spacing-layout-outer) max-h-[calc(50%-var(--spacing-layout-outer)-4px)]',
  'float-tl':
    'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))] left-(--spacing-layout-outer) max-h-[calc(50%-var(--spacing-layout-outer)-4px)]',
  'float-bl':
    'bottom-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))] left-(--spacing-layout-outer) max-h-[calc(50%-var(--spacing-layout-outer)-4px)]'
}

const presetClass = computed(() => PRESET_CLASSES[props.preset])
const heightStyle = computed(() =>
  props.panelHeight != null ? { height: `${props.panelHeight}px` } : undefined
)
</script>

<template>
  <div
    :class="[
      // Base chrome: absolute, brand-blue outline + 30% tint fill,
      // content non-interactive, animated through the shared layout
      // duration/easing so the preview tweens between presets.
      'duration-layout pointer-events-none absolute z-20 w-(--panel-dock-width,440px) rounded-[10px] border-2 border-primary-background bg-primary-background/30 transition-[top,bottom,left,right,max-height] ease-layout',
      presetClass
    ]"
    :style="heightStyle"
    aria-hidden="true"
    data-testid="panel-drag-preview"
  />
</template>
