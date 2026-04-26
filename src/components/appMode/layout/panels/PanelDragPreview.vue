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

import { PANEL_PRESET_CLASSES } from './panelPresetClasses'
import type { PanelPreset } from './panelTypes'

const props = defineProps<{
  preset: PanelPreset
  panelHeight?: number
  panelWidth?: number
}>()

// Preset classes are shared with FloatingPanel via
// `PANEL_PRESET_CLASSES` so the drop preview always lands where the
// live panel will.
const presetClass = computed(() => PANEL_PRESET_CLASSES[props.preset])
// Match the live panel's rendered dimensions so the preview lands the
// same size the panel will — important when the user has drag-resized
// the dock wider than the default.
const sizeStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.panelHeight != null) style.height = `${props.panelHeight}px`
  if (props.panelWidth != null) style.width = `${props.panelWidth}px`
  return Object.keys(style).length > 0 ? style : undefined
})
</script>

<template>
  <div
    :class="[
      // Base chrome: absolute, accent-temp outline + 30% tint fill,
      // content non-interactive, animated through the shared layout
      // duration/easing so the preview tweens between presets.
      'pointer-events-none absolute z-20',
      'w-(--panel-dock-width,440px)',
      'rounded-[10px] border-2 border-(--color-app-mode-accent-temp)',
      'bg-(--color-app-mode-accent-temp-wash)',
      'duration-layout transition-[top,bottom,left,right,max-height] ease-layout',
      presetClass
    ]"
    :style="sizeStyle"
    aria-hidden="true"
    data-testid="panel-drag-preview"
  />
</template>
