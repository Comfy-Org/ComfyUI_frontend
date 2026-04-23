<script setup lang="ts">
/**
 * FloatingPanel — the unified floating input panel used by both App Mode
 * (runtime) and App Builder (edit). Owns the preset-based absolute
 * positioning, the drag-to-snap interaction, the collapse toggle, and
 * the snap preview so every consumer gets identical behavior without
 * re-implementing it.
 *
 * Header is Vizcom-style: collapse chevron on the left, title centered
 * against it, 3-dot menu on the right. A 1px border-bottom visually
 * separates the header (which is the drag grip) from the body.
 *
 * API:
 *   v-model:preset    — two-way preset binding (right-dock, left-dock,
 *     float-tr/tl/br/bl). Drag commits flow back via update:preset.
 *   v-model:collapsed — two-way collapse binding. When true, body +
 *     footer are hidden and the panel shrinks to the header pill.
 *   movable           — opt-in for drag. When false, the header is
 *     static (no grab cursor).
 *   title             — optional panel title shown in the header.
 *
 * Events:
 *   reset-layout      — fired when the user picks "Reset layout" from
 *     the header menu. Consumers may re-seed panel state; preset +
 *     collapsed are reset internally via the v-model bindings.
 *
 * A single appModeStore.panelPreset + panelCollapsed are the shared
 * source. Both LayoutView and BuilderPanel bind them here, so moving
 * or collapsing the panel in either view updates both (WYSIWYG by
 * construction).
 */
import { cn } from '@comfyorg/tailwind-utils'
import { useElementSize } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'

import PanelDragPreview from './PanelDragPreview.vue'
import type { PanelPreset } from './panelTypes'
import { usePanelDrag } from './usePanelDrag'

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
// height. Only consumed while dragging; rounded to int to avoid
// subpixel jitter in the blue rectangle.
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const { height: panelHeight } = useElementSize(panelRef)
const previewHeight = computed(() => Math.round(panelHeight.value))

// Preset positions — each preset pins one anchor edge (top/left or
// bottom/right). Dock presets use a fixed `height` so the panel
// stretches to fill the vertical slot (small content leaves dead
// space at the bottom rather than the panel shrinking). Float
// presets use `max-height` so they remain content-driven. Kept in a
// map rather than inline cn() so each preset's geometry reads as one
// block. Mirrors PanelDragPreview exactly — keep them in sync.
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
    'w-(--panel-dock-width,440px) max-w-[calc(100vw-var(--spacing-layout-outer)*2)]',
    'rounded-[10px] border border-white/8 bg-layout-cell backdrop-blur-sm',
    'shadow-[0_2px_4px_rgb(0_0_0/0.4),0_16px_48px_rgb(0_0_0/0.45)]',
    'duration-layout ease-layout',
    // Split the transition property list by drag state: while dragging,
    // only opacity tweens (position is driven by pointer, not CSS) so
    // the multi-property transition below would cause a trailing easing
    // pop when the commit lands.
    movable && isDragging.value
      ? 'opacity-[0.55] transition-opacity'
      : 'transition-[top,bottom,left,right,max-height,height,opacity]',
    PRESET_CLASSES[preset.value],
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
      emit('reset-layout')
    }
  }
])
</script>

<template>
  <section ref="panelRef" :class="sectionClass">
    <!-- Vizcom-style header strip: also the drag grip when `movable`.
         Distinct header-fill so the grabbable region reads at a glance
         without a hard divider. Grab cursor switches to grabbing while
         the panel is being dragged. -->
    <header
      :class="
        cn(
          'flex min-h-layout-cell items-center gap-2 bg-(--color-layout-header-fill) px-[10px] py-2 select-none',
          movable && 'cursor-grab touch-none',
          movable && isDragging && 'cursor-grabbing'
        )
      "
      @pointerdown="handleHeaderPointerDown"
    >
      <button
        type="button"
        data-header-control
        class="duration-layout inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-layout-text transition-colors ease-layout hover:bg-layout-cell-hover [&>i]:size-[18px]"
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
            class="duration-layout inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-layout-text transition-colors ease-layout hover:bg-layout-cell-hover [&>i]:size-[18px]"
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
  />
</template>
