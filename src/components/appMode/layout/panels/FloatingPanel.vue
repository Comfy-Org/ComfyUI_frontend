<script setup lang="ts">
/**
 * Unified floating input panel for App Mode and App Builder. Owns
 * preset-based positioning, drag-to-snap, resize, collapse, and the
 * snap preview so both consumers get identical behavior. Position +
 * collapse + width are bound to `appModeStore` so changes propagate
 * WYSIWYG between modes.
 */
import { cn } from '@comfyorg/tailwind-utils'
import { useElementSize } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import { useAppModeStore } from '@/stores/appModeStore'

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

// Measure the live panel so the drag preview lands at its content-fit
// dimensions. Rounded to int to avoid subpixel jitter on the outline.
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const { width: panelWidth, height: panelHeight } = useElementSize(panelRef)
const previewHeight = computed(() => Math.round(panelHeight.value))
const previewWidth = computed(() => Math.round(panelWidth.value))

const appModeStore = useAppModeStore()
const { panelWidthCells } = storeToRefs(appModeStore)

const isDocked = computed(() => isDockPreset(preset.value))

// Per-instance width override: overrides the global `--panel-dock-width`
// token on this element only, so sibling chrome (AppChrome cell
// alignment) isn't affected by the user's resize.
const widthStyle = computed(() => {
  if (!isDocked.value) return undefined
  const cells = panelWidthCells.value
  return {
    width:
      `calc(${cells} * var(--spacing-layout-cell) ` +
      `+ ${cells - 1} * var(--spacing-layout-gutter))`
  }
})

// Resize is dock-only — the handle is an invisible hit-strip on the
// panel's inner edge; cursor change on hover is the only affordance.
const { startResize } = usePanelResize({
  side: computed(() => panelSide(preset.value)),
  widthCells: panelWidthCells
})

const sectionClass = computed(() =>
  cn(
    // pointer-events-auto keeps the panel interactive even though the
    // parent surface is pointer-events-none (so canvas clicks fall
    // through empty chrome space).
    'floating-panel pointer-events-auto absolute z-10 flex flex-col overflow-hidden',
    !isDocked.value && 'w-(--panel-dock-width,440px)',
    'max-w-[calc(100vw-var(--spacing-layout-outer)*2)]',
    'rounded-[10px] border border-white/8 bg-layout-cell',
    // backdrop-blur off while dragging: the GPU recomposes the blur
    // every frame against the layer behind, which tanks framerate
    // when a run is repainting the latent preview at the same time.
    !isDragging.value && 'backdrop-blur-sm',
    'shadow-[0_2px_4px_rgb(0_0_0/0.4),0_16px_48px_rgb(0_0_0/0.45)]',
    'duration-layout ease-layout',
    // While dragging, only opacity tweens — position is pointer-driven,
    // not CSS, and a multi-property transition would pop on commit.
    movable && isDragging.value
      ? 'opacity-[0.15] transition-opacity'
      : 'transition-[top,bottom,left,right,opacity]',
    PANEL_PRESET_CLASSES[preset.value],
    // Collapsed: release the off-corner anchor so the section shrinks
    // to header-only. Bottom-anchored floats re-pin at the bottom so
    // the header hugs the lower chrome rail.
    collapsed.value && [
      'h-auto max-h-none',
      isFloatBottom(preset.value) ? 'top-auto' : 'bottom-auto'
    ]
  )
)

function handleHeaderPointerDown(e: PointerEvent) {
  if (!movable) return
  // Skip pointerdown on header controls (chevron, menu) so clicking
  // them doesn't start a drag. Element narrow guards against Document
  // / Window targets (legal but rare) crashing .closest().
  const target = e.target
  if (target instanceof Element && target.closest('[data-header-control]'))
    return
  onHeaderPointerDown(e)
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

const HEADER_CONTROL_CLASS =
  'inline-flex size-8 cursor-pointer items-center justify-center ' +
  'rounded-md border-0 bg-transparent text-layout-text ' +
  'transition-colors duration-layout ease-layout ' +
  'hover:bg-layout-cell-hover [&>i]:size-[18px]'

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
      // Reset drag-resized width back to the default 8-cell dock.
      panelWidthCells.value = 8
      emit('reset-layout')
    }
  }
])
</script>

<template>
  <section ref="panelRef" :class="sectionClass" :style="widthStyle">
    <!-- Resize hit-strip on the dock's inner edge (left for right-dock
         and vice versa). 6px wide so it's grabbable without a visible
         handle; the ew-resize cursor is the only affordance. -->
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
    <!-- Header is also the drag grip when `movable`. Distinct
         header-fill so the grabbable region reads at a glance. -->
    <header
      :class="
        cn(
          'flex min-h-layout-cell items-center gap-2 select-none',
          'bg-(--color-layout-header-fill) px-[10px] py-2',
          'border-b border-white/8',
          movable && 'cursor-grab touch-none',
          movable && isDragging && 'cursor-grabbing'
        )
      "
      @pointerdown="handleHeaderPointerDown"
    >
      <button
        type="button"
        data-header-control
        :class="HEADER_CONTROL_CLASS"
        :aria-label="
          collapsed
            ? t('linearMode.floatingPanel.expand')
            : t('linearMode.floatingPanel.collapse')
        "
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
        @pointerdown.stop
      >
        <i
          :class="
            collapsed
              ? 'icon-[lucide--chevron-right]'
              : 'icon-[lucide--chevron-down]'
          "
        />
      </button>

      <span
        v-if="title"
        class="truncate text-layout-md font-semibold text-layout-text"
        >{{ title }}</span
      >
      <div class="min-w-0 flex-1" />

      <Popover
        :entries="menuEntries"
        :show-arrow="false"
        to="body"
        class="min-w-44 p-1"
      >
        <template #button>
          <button
            type="button"
            data-header-control
            :class="HEADER_CONTROL_CLASS"
            :aria-label="t('linearMode.floatingPanel.menu')"
            @pointerdown.stop
          >
            <i class="icon-[lucide--ellipsis]" />
          </button>
        </template>
      </Popover>
    </header>

    <!-- Body is content-driven, not flex-1: short widget lists shrink
         the panel; `min-h-0` lets flex-shrink engage scroll when
         content exceeds the section's max-height cap. -->
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
