<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementSize } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

import PanelHeader from '../PanelHeader.vue'
import PanelDragPreview from './PanelDragPreview.vue'
import { PANEL_PRESET_CLASSES } from './panelPresetClasses'
import { isDockPreset, isFloatBottom, panelSide } from './panelTypes'
import type { PanelPreset } from './panelTypes'
import { usePanelDrag } from './usePanelDrag'
import { usePanelResize } from './usePanelResize'

const {
  title,
  movable = false,
  defaultPreset = 'right-dock'
} = defineProps<{
  title?: string
  movable?: boolean
  /** Preset to restore when the user picks "Reset layout". */
  defaultPreset?: PanelPreset
}>()

const preset = defineModel<PanelPreset>('preset', { required: true })
const collapsed = defineModel<boolean>('collapsed', { default: false })

const emit = defineEmits<{
  'reset-layout': []
}>()

const { t } = useI18n()

const { isDragging, snapTarget, onHeaderPointerDown } = usePanelDrag({
  currentPreset: preset,
  onCommit: (next) => (preset.value = next)
})

// Round to int — subpixel jitters the drag-preview outline.
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const { width: panelWidth, height: panelHeight } = useElementSize(panelRef)
const previewHeight = computed(() => Math.round(panelHeight.value))
const previewWidth = computed(() => Math.round(panelWidth.value))

const appModeStore = useAppModeStore()
const { panelWidthCells } = storeToRefs(appModeStore)

const isDocked = computed(() => isDockPreset(preset.value))

// Per-instance override; sibling chrome stays anchored to the token default.
const widthStyle = computed(() => {
  if (!isDocked.value) return undefined
  const cells = panelWidthCells.value
  return {
    width:
      `calc(${cells} * var(--spacing-layout-cell) ` +
      `+ ${cells - 1} * var(--spacing-layout-gutter))`
  }
})

const { startResize } = usePanelResize({
  side: computed(() => panelSide(preset.value)),
  widthCells: panelWidthCells
})

const sectionClass = computed(() =>
  cn(
    // `app-mode-themed` toggles the App Mode widget overrides in
    // src/assets/css/style.css. Drop the class to fall back to
    // primevue / design-system widget defaults.
    'app-mode-themed floating-panel pointer-events-auto absolute z-10 flex flex-col overflow-hidden',
    !isDocked.value && 'w-(--panel-dock-width,440px)',
    'max-w-[calc(100vw-var(--spacing-layout-outer)*2)]',
    'rounded-[10px] border border-white/8 bg-layout-cell',
    // Drop blur while dragging — re-computing it every frame tanks
    // framerate when a run is repainting in parallel.
    !isDragging.value && 'backdrop-blur-sm',
    'shadow-[0_2px_4px_rgb(0_0_0/0.4),0_16px_48px_rgb(0_0_0/0.45)]',
    'duration-layout ease-layout',
    movable && isDragging.value
      ? 'opacity-[0.15] transition-opacity'
      : 'transition-[top,bottom,left,right,opacity]',
    PANEL_PRESET_CLASSES[preset.value],
    collapsed.value && [
      'h-auto max-h-none',
      isFloatBottom(preset.value) ? 'top-auto' : 'bottom-auto'
    ]
  )
)

function handleHeaderPointerDown(e: PointerEvent) {
  if (!movable) return
  onHeaderPointerDown(e)
}

const menuEntries = computed<MenuItem[]>(() => [
  {
    label: collapsed.value
      ? t('linearMode.floatingPanel.showPanel')
      : t('linearMode.floatingPanel.hidePanel'),
    icon: collapsed.value
      ? 'icon-[lucide--chevron-down]'
      : 'icon-[lucide--chevron-right]',
    command: () => (collapsed.value = !collapsed.value)
  },
  {
    label: t('linearMode.floatingPanel.resetLayout'),
    icon: 'icon-[lucide--rotate-ccw]',
    command: () => {
      preset.value = defaultPreset
      collapsed.value = false
      panelWidthCells.value = 8
      emit('reset-layout')
    }
  }
])
</script>

<template>
  <section ref="panelRef" :class="sectionClass" :style="widthStyle">
    <!-- Invisible resize hit-strip; cursor is the only affordance. -->
    <div
      v-if="isDocked"
      :class="
        cn(
          'absolute inset-y-0 z-20 w-[6px] cursor-ew-resize',
          panelSide(preset) === 'left' ? 'right-0' : 'left-0'
        )
      "
      @pointerdown="startResize"
    />
    <PanelHeader
      v-model:collapsed="collapsed"
      :title="title"
      :draggable="movable"
      :dragging="isDragging"
      :menu-entries="menuEntries"
      :collapse-label="t('linearMode.floatingPanel.collapse')"
      :expand-label="t('linearMode.floatingPanel.expand')"
      :menu-label="t('linearMode.floatingPanel.menu')"
      @pointerdown="handleHeaderPointerDown"
    />

    <div v-show="!collapsed" class="min-h-0 overflow-y-auto p-4">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      v-show="!collapsed"
      class="shrink-0 bg-(--color-layout-header-fill) p-4"
    >
      <slot name="footer" />
    </div>
  </section>
  <PanelDragPreview
    v-if="movable && isDragging"
    :preset="snapTarget"
    :panel-height="previewHeight"
    :panel-width="previewWidth"
  />
</template>
