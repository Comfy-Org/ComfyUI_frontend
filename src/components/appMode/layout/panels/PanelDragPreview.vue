<script setup lang="ts">
/**
 * Translucent outline at the snap-target preset's bounds during a
 * panel drag — signals where the panel will land on release.
 */
import { cn } from '@comfyorg/tailwind-utils'
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
// Skip explicit width + height on docks — docks are slot-sized, so
// applying the floating-panel dimensions would override the dock's
// CSS variable widths and bottom anchor.
const sizeStyle = computed(() => {
  const style: Record<string, string> = {}
  if (!isDocked.value && props.panelHeight != null)
    style.height = `${props.panelHeight}px`
  if (!isDocked.value && props.panelWidth != null)
    style.width = `${props.panelWidth}px`
  return Object.keys(style).length > 0 ? style : undefined
})
</script>

<template>
  <div
    :class="
      cn(
        'pointer-events-none absolute z-20',
        'w-(--panel-dock-width,440px)',
        'rounded-[10px] border-2 border-primary-background',
        'bg-primary-background/30',
        'duration-layout transition-[top,bottom,left,right,max-height] ease-layout',
        presetClass
      )
    "
    :style="sizeStyle"
    aria-hidden="true"
    data-testid="panel-drag-preview"
  />
</template>
