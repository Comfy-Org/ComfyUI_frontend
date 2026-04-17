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
import type { MenuItem } from 'primevue/menuitem'
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'

import PanelDragPreview from './PanelDragPreview.vue'
import type { PanelPreset } from './panelTypes'
import { usePanelDrag } from './usePanelDrag'

const props = withDefaults(
  defineProps<{
    preset: PanelPreset
    collapsed?: boolean
    title?: string
    movable?: boolean
    /** Preset to restore when the user picks "Reset layout". */
    defaultPreset?: PanelPreset
  }>(),
  {
    collapsed: false,
    title: undefined,
    movable: false,
    defaultPreset: 'right-dock'
  }
)

const emit = defineEmits<{
  'update:preset': [preset: PanelPreset]
  'update:collapsed': [collapsed: boolean]
  'reset-layout': []
}>()

const { t } = useI18n()

const { isDragging, snapTarget, onHeaderPointerDown } = usePanelDrag({
  currentPreset: toRef(props, 'preset'),
  onCommit: (preset) => emit('update:preset', preset)
})

const positionClass = computed(() => [
  `floating-panel--${props.preset}`,
  props.movable && isDragging.value ? 'floating-panel--dragging' : null,
  props.collapsed ? 'floating-panel--collapsed' : null
])

function handleHeaderPointerDown(e: PointerEvent) {
  if (!props.movable) return
  // Ignore pointerdown on interactive header controls so clicking the
  // collapse chevron / menu button doesn't start a drag.
  const target = e.target as HTMLElement | null
  if (target?.closest('.floating-panel__header-control')) return
  onHeaderPointerDown(e)
}

function toggleCollapsed() {
  emit('update:collapsed', !props.collapsed)
}

const menuEntries = computed<MenuItem[]>(() => [
  {
    label: props.collapsed
      ? t('linearMode.floatingPanel.showPanel')
      : t('linearMode.floatingPanel.hidePanel'),
    icon: props.collapsed
      ? 'icon-[lucide--chevron-down]'
      : 'icon-[lucide--chevron-right]',
    command: () => emit('update:collapsed', !props.collapsed)
  },
  {
    label: t('linearMode.floatingPanel.resetLayout'),
    icon: 'icon-[lucide--rotate-ccw]',
    command: () => {
      emit('update:preset', props.defaultPreset)
      emit('update:collapsed', false)
      emit('reset-layout')
    }
  }
])
</script>

<template>
  <section class="floating-panel" :class="positionClass">
    <header
      class="floating-panel__header"
      :class="{ 'floating-panel__header--movable': movable }"
      @pointerdown="handleHeaderPointerDown"
    >
      <button
        type="button"
        class="floating-panel__header-control floating-panel__collapse-toggle"
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

      <span v-if="title" class="floating-panel__title">{{ title }}</span>
      <div class="floating-panel__header-spacer" />

      <Popover
        :entries="menuEntries"
        :show-arrow="false"
        to="body"
        class="min-w-44 p-1"
      >
        <template #button>
          <button
            type="button"
            class="floating-panel__header-control floating-panel__menu-button"
            :aria-label="t('linearMode.floatingPanel.menu')"
            @pointerdown.stop
          >
            <i class="icon-[lucide--ellipsis]" />
          </button>
        </template>
      </Popover>
    </header>

    <div v-show="!collapsed" class="floating-panel__body">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      v-show="!collapsed"
      class="floating-panel__footer"
    >
      <slot name="footer" />
    </div>
  </section>
  <PanelDragPreview v-if="movable && isDragging" :preset="snapTarget" />
</template>

<style scoped>
.floating-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  width: var(--panel-dock-width, 420px);
  max-width: calc(100vw - var(--layout-outer-padding) * 2);
  background-color: var(--layout-color-cell-fill);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 10px;
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.4),
    0 16px 48px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(8px);
  overflow: hidden;
  z-index: 10;
  transition:
    top var(--layout-transition-duration) var(--layout-transition-easing),
    bottom var(--layout-transition-duration) var(--layout-transition-easing),
    left var(--layout-transition-duration) var(--layout-transition-easing),
    right var(--layout-transition-duration) var(--layout-transition-easing),
    max-height var(--layout-transition-duration) var(--layout-transition-easing),
    height var(--layout-transition-duration) var(--layout-transition-easing),
    opacity var(--layout-transition-duration) var(--layout-transition-easing);
}

/* While dragging, fade the live panel so the blue preview reads as the
   destination and the panel itself reads as the thing being moved. */
.floating-panel--dragging {
  opacity: 0.55;
  transition: opacity var(--layout-transition-duration)
    var(--layout-transition-easing);
}

/* Collapsed state: let the section size itself to just the header pill.
   The preset positioning still anchors top/left/right (or bottom), so
   only the height constraint needs releasing. */
.floating-panel--collapsed {
  bottom: auto !important;
  height: auto !important;
  max-height: none !important;
}

/* Preset positions — hard-coded for Phase 4-A. Drag commits these
   same values. */
.floating-panel--right-dock {
  top: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
  right: var(--layout-outer-padding);
  bottom: var(--layout-outer-padding);
}
.floating-panel--left-dock {
  top: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
  left: var(--layout-outer-padding);
  bottom: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
}
.floating-panel--float-tr {
  top: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
  right: var(--layout-outer-padding);
  height: calc(50% - var(--layout-outer-padding) - 4px);
}
.floating-panel--float-br {
  bottom: var(--layout-outer-padding);
  right: var(--layout-outer-padding);
  height: calc(50% - var(--layout-outer-padding) - 4px);
}
.floating-panel--float-tl {
  top: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
  left: var(--layout-outer-padding);
  height: calc(50% - var(--layout-outer-padding) - 4px);
}
.floating-panel--float-bl {
  bottom: calc(
    var(--layout-outer-padding) + var(--layout-cell-size) +
      var(--layout-gutter-min)
  );
  left: var(--layout-outer-padding);
  height: calc(50% - var(--layout-outer-padding) - 4px);
}

/* Header — the Vizcom-style strip that also acts as the drag grip.
   Uses a distinct fill (halfway between panel body and canvas) so the
   grabbable region reads at a glance; no hard border needed. */
.floating-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  min-height: 48px;
  user-select: none;
  background-color: var(--layout-color-header-fill);
}

/* Movable header: grab cursor + touch-action so pointer capture works
   on touch devices. Non-movable header stays the default cursor. */
.floating-panel__header--movable {
  cursor: grab;
  touch-action: none;
}

.floating-panel--dragging .floating-panel__header--movable {
  cursor: grabbing;
}

/* Interactive controls inside the header — chevron toggle + menu.
   Reset the grab cursor so they read as buttons; hover treatment
   matches IconCell (subtle canvas-dark). */
.floating-panel__header-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--layout-color-text);
  cursor: pointer;
  transition: background-color var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.floating-panel__header-control:hover {
  background-color: var(--layout-color-cell-hover);
}

.floating-panel__header-control > i {
  width: 18px;
  height: 18px;
}

.floating-panel__title {
  font-size: var(--layout-font-md);
  font-weight: 600;
  color: var(--layout-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.floating-panel__header-spacer {
  flex: 1;
  min-width: 0;
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
  background-color: var(--layout-color-header-fill);
}
</style>
