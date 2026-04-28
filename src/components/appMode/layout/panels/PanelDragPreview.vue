<script setup lang="ts">
/**
 * Translucent outline rendered at the snap-target preset's bounds
 * during a panel drag. Sits above the live panel to signal where it
 * will land on release.
 */
import { computed } from 'vue'

import { PANEL_PRESET_CLASSES } from './panelPresetClasses'
import { isDockPreset } from './panelTypes'
import type { PanelPreset } from './panelTypes'

const props = defineProps<{
  preset: PanelPreset
  panelHeight?: number
  panelWidth?: number
}>()

const presetClass = computed(() => PANEL_PRESET_CLASSES[props.preset])
const isDocked = computed(() => isDockPreset(props.preset))
// Match the live panel's rendered dimensions so the preview lands at
// the size the panel will. Dock presets span the full slot via
// top+bottom anchors, so leave height out for them — an explicit
// height would override the bottom anchor and shrink the preview to
// the live panel's content-fit height.
const sizeStyle = computed(() => {
  const style: Record<string, string> = {}
  if (!isDocked.value && props.panelHeight != null)
    style.height = `${props.panelHeight}px`
  if (props.panelWidth != null) style.width = `${props.panelWidth}px`
  return Object.keys(style).length > 0 ? style : undefined
})
</script>

<template>
  <div
    :class="[
      // Accent-temp outline + 30% tint fill, animated through the
      // shared layout duration/easing so the preview tweens between
      // presets when the snap target changes.
      'pointer-events-none absolute z-20',
      'w-(--panel-dock-width,440px)',
      'rounded-[10px] border-2 border-primary-background',
      'bg-primary-background/30',
      'duration-layout transition-[top,bottom,left,right,max-height] ease-layout',
      presetClass
    ]"
    :style="sizeStyle"
    aria-hidden="true"
    data-testid="panel-drag-preview"
  />
</template>
