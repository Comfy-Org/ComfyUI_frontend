<script setup lang="ts">
/**
 * FloatingPanel — the unified floating input panel used by both App Mode
 * (runtime) and App Builder (edit). Owns the preset-based absolute
 * positioning, the drag-to-snap interaction, the collapse toggle, and
 * the snap preview so every consumer gets identical behavior without
 * re-implementing it.
 *
 * Header: collapse chevron on the left, title centered against it,
 * 3-dot menu on the right. The header itself is the drag grip; a
 * distinct header-fill signals the grabbable region without a hard
 * divider.
 *
 * Props:
 * - `title` — optional title shown in the header.
 * - `movable` (default `false`) — opt-in for drag. When false the
 *   header is static (no grab cursor).
 * - `defaultPreset` (default `right-dock`) — preset restored when the
 *   user picks "Reset layout".
 *
 * Two-way bindings (v-model):
 * - `preset` (required) — panel position. One of right-dock,
 *   left-dock, or float-tr/tl/br/bl. Drag commits flow back via this.
 * - `collapsed` (default `false`) — when true, body and footer are
 *   hidden and the panel shrinks to the header pill.
 *
 * Events:
 * - `reset-layout` — fires when the user picks "Reset layout" from
 *   the header menu. Consumers may re-seed their own state; preset
 *   and collapsed reset internally via the v-model bindings.
 *
 * A single appModeStore.panelPreset + panelCollapsed are the shared
 * source. Both LayoutView and BuilderPanel bind them here, so moving
 * or collapsing the panel in either view updates both (WYSIWYG by
 * construction).
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

// v-model-backed state (panel position + collapse). Using defineModel
// instead of manual `emit('update:X')` lets parents stay declarative
// with v-model:preset / v-model:collapsed and avoids repeating the
// event-name contract at both ends.
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

// Measure the live panel so the drag preview matches its content-fit
// height + current width. Only consumed while dragging; rounded to
// int to avoid subpixel jitter in the blue rectangle.
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const { width: panelWidth, height: panelHeight } = useElementSize(panelRef)
const previewHeight = computed(() => Math.round(panelHeight.value))
const previewWidth = computed(() => Math.round(panelWidth.value))

// Panel width is in grid cells, stored at the app-mode level so it
// survives preset swaps and mode transitions. Only the dock presets
// use this; float presets stay at the default 8-cell width.
const appModeStore = useAppModeStore()
const { panelWidthCells } = storeToRefs(appModeStore)

const isDockPreset = computed(
  () => preset.value === 'right-dock' || preset.value === 'left-dock'
)

// Compute the panel's own width in px from cell count. Overrides the
// global --panel-dock-width token on this instance only so sibling
// chrome that reads the token (AppChrome cell alignment) isn't
// affected by the user's resize.
const widthStyle = computed(() => {
  if (!isDockPreset.value) return undefined
  const cells = panelWidthCells.value
  return {
    width:
      `calc(${cells} * var(--spacing-layout-cell) ` +
      `+ ${cells - 1} * var(--spacing-layout-gutter))`
  }
})

// Resize drag: active only when the panel is docked. The handle is an
// invisible hit-strip on the panel's inner edge so the affordance
// doesn't clutter the chrome — the cursor change on hover is the
// signal. Drag direction is determined by which side is inner.
const { startResize } = usePanelResize({
  side: computed(() => (preset.value === 'right-dock' ? 'right' : 'left')),
  widthCells: panelWidthCells
})

// Preset positioning is shared with PanelDragPreview via
// `PANEL_PRESET_CLASSES` (./panelPresetClasses) so the live panel and
// the drop-target outline always land at the same coordinates.

// Build the full class list for the floating-panel section. Classname
// `floating-panel` is kept as an external CSS hook — `src/assets/css/
// style.css` targets `.floating-panel textarea`/`input`/etc. to rewrite
// the widget-background palette inside the panel context.
const sectionClass = computed(() =>
  cn(
    // pointer-events-auto keeps the panel interactive even when the
    // parent surface (LayoutView / BuilderPanel root) is pointer-events-
    // none to let canvas clicks fall through empty chrome space.
    'floating-panel pointer-events-auto absolute z-10 flex flex-col overflow-hidden',
    // Width: dock presets pull from the reactive panelWidthCells state
    // (applied via :style below) so the user can drag-resize; float
    // presets fall back to the default --panel-dock-width token.
    !isDockPreset.value && 'w-(--panel-dock-width,440px)',
    'max-w-[calc(100vw-var(--spacing-layout-outer)*2)]',
    'rounded-[10px] border border-white/8 bg-layout-cell backdrop-blur-sm',
    'shadow-[0_2px_4px_rgb(0_0_0/0.4),0_16px_48px_rgb(0_0_0/0.45)]',
    'duration-layout ease-layout',
    // Split the transition property list by drag state: while dragging,
    // only opacity tweens (position is driven by pointer, not CSS) so
    // the multi-property transition below would cause a trailing easing
    // pop when the commit lands.
    //
    // Fade the live panel heavily while dragging so the PanelDragPreview
    // (which may land at the same preset the panel is already docked
    // at — e.g., mousing around the right half while docked-right)
    // reads as the dominant blue outline rather than being masked by
    // the live panel's own contents.
    movable && isDragging.value
      ? 'opacity-[0.15] transition-opacity'
      : 'transition-[top,bottom,left,right,max-height,height,opacity]',
    PANEL_PRESET_CLASSES[preset.value],
    // Collapsed state: release size constraints (height, max-height) but
    // NOT positional anchors. Placed last so tw-merge lets h-auto /
    // max-h-none override the preset's max-h-[calc(...)] cap.
    collapsed.value && 'h-auto max-h-none'
  )
)

function handleHeaderPointerDown(e: PointerEvent) {
  if (!movable) return
  // Ignore pointerdown on interactive header controls so clicking the
  // collapse chevron / menu button doesn't start a drag. Header controls
  // carry a `data-header-control` attribute (semantic hook, not a CSS
  // selector). `e.target` is typed EventTarget; narrow to Element before
  // walking ancestors so Document / Window targets (rare but legal)
  // don't crash .closest().
  const target = e.target
  if (target instanceof Element && target.closest('[data-header-control]'))
    return
  onHeaderPointerDown(e)
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

// Shared class list for the two interactive controls inside the
// header (collapse chevron + 3-dot menu). They look identical —
// 32px square, no border, subtle canvas-dark hover — so keep one
// source of truth rather than duplicating the utility list inline.
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
    <!-- Invisible resize hit-strip pinned to the panel's inner edge —
         left edge for right-dock, right edge for left-dock. 6px wide
         so it's easy to grab without cluttering the chrome with a
         visible handle; the ew-resize cursor on hover is the only
         affordance. Dock presets only — float panels stay at default
         width. -->
    <div
      v-if="isDockPreset"
      :class="
        cn(
          'absolute inset-y-0 z-20 w-[6px] cursor-ew-resize',
          preset === 'right-dock' ? 'left-0' : 'right-0'
        )
      "
      @pointerdown="startResize"
    />
    <!-- Header strip: also the drag grip when `movable`. Distinct
         header-fill so the grabbable region reads at a glance without
         a hard divider. Grab cursor switches to grabbing while the
         panel is being dragged. -->
    <header
      :class="
        cn(
          'flex min-h-layout-cell items-center gap-2 select-none',
          'bg-(--color-layout-header-fill) px-[10px] py-2',
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

    <div v-show="!collapsed" class="min-h-0 flex-1 overflow-y-auto p-4">
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
