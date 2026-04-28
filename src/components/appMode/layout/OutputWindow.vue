<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

import { usePointerDrag } from './panels/usePointerDrag'
import PanelHeader from './PanelHeader.vue'

const { t } = useI18n()
const {
  width = 512,
  // Fallback before an image lands; bodyAspect takes over once known.
  height = 560,
  title,
  menuEntries = [],
  initialPosition,
  zIndex,
  bodyAspect
} = defineProps<{
  width?: number
  height?: number
  title?: string
  /** Appended below the internal Maximize / Restore entry. */
  menuEntries?: MenuItem[]
  /** Workspace-coord starting position. Listen for `update:position` for committed values. */
  initialPosition?: { x: number; y: number }
  zIndex?: number
  /** `naturalWidth / naturalHeight`; when set, body uses CSS aspect-ratio. */
  bodyAspect?: number
}>()

const emit = defineEmits<{
  'update:position': [position: { x: number; y: number }]
  promote: []
}>()

const collapsed = ref(false)
const maximized = ref(false)
function toggleMaximized() {
  maximized.value = !maximized.value
}

const appModeStore = useAppModeStore()
const { viewportScale } = storeToRefs(appModeStore)

const GRID = 16
const snap = (v: number) => Math.round(v / GRID) * GRID

const wx = ref(0)
const wy = ref(0)

onMounted(() => {
  if (initialPosition) {
    wx.value = snap(initialPosition.x)
    wy.value = snap(initialPosition.y)
    return
  }
  // No initial position → center in the viewport.
  wx.value = snap(Math.max(0, (window.innerWidth - width) / 2))
  wy.value = snap(Math.max(0, (window.innerHeight - height) / 2 - 32))
})

// Skipped while dragging so we don't fight the pointer with stale values.
watch(
  () => initialPosition,
  (next) => {
    if (!next || dragging.value) return
    if (next.x === wx.value && next.y === wy.value) return
    wx.value = snap(next.x)
    wy.value = snap(next.y)
  }
)

let dragStart: { px: number; py: number; bx: number; by: number } | null = null

const { isDragging: dragging, start: handleHeaderPointerDown } = usePointerDrag(
  {
    stopPropagation: true,
    onStart: (e) => {
      if (e.button !== 0) return false
      // Promote even when maximized — only the drag is gated.
      emit('promote')
      if (maximized.value) return false
      dragStart = { px: e.clientX, py: e.clientY, bx: wx.value, by: wy.value }
    },
    onMove: (e) => {
      if (!dragStart) return
      // Divide by scale so the cursor stays stuck to the header at
      // any zoom (pointer is screen px; position is workspace px).
      const s = viewportScale.value || 1
      wx.value = snap(dragStart.bx + (e.clientX - dragStart.px) / s)
      wy.value = snap(dragStart.by + (e.clientY - dragStart.py) / s)
    },
    onCommit: () => {
      emit('update:position', { x: wx.value, y: wy.value })
    },
    onReset: () => {
      dragStart = null
    }
  }
)

const combinedMenuEntries = computed<MenuItem[]>(() => {
  const own: MenuItem[] = [
    {
      icon: maximized.value
        ? 'icon-[lucide--minimize] size-[18px]'
        : 'icon-[lucide--maximize] size-[18px]',
      label: maximized.value
        ? t('linearMode.outputs.restore')
        : t('linearMode.outputs.maximize'),
      command: toggleMaximized
    }
  ]
  if (menuEntries.length === 0) return own
  return [...own, { separator: true }, ...menuEntries]
})
</script>

<template>
  <section
    class="panel-chrome floating-panel pointer-events-auto absolute flex flex-col overflow-hidden"
    :style="
      maximized
        ? { inset: '0px', zIndex: zIndex ?? 30 }
        : {
            // translate3d keeps drag on the compositor; the trailing 0
            // forces an upfront 3D layer instead of first-move promotion.
            transform: `translate3d(${wx}px, ${wy}px, 0)`,
            width: `${width}px`,
            zIndex: zIndex ?? 30,
            ...(collapsed || bodyAspect != null
              ? {}
              : { height: `${height}px` })
          }
    "
  >
    <PanelHeader
      v-model:collapsed="collapsed"
      :title="title || t('linearMode.outputs.title')"
      :draggable="!maximized"
      :dragging="dragging"
      :collapsible="!maximized"
      :menu-entries="combinedMenuEntries"
      :collapse-label="t('linearMode.floatingPanel.collapse')"
      :expand-label="t('linearMode.floatingPanel.expand')"
      :menu-label="t('linearMode.floatingPanel.menu')"
      @pointerdown="handleHeaderPointerDown"
    >
      <template #actions>
        <slot name="header-actions-right" />
      </template>
    </PanelHeader>
    <div
      v-show="!collapsed"
      class="group/output relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <!-- bodyAspect: aspect-ratio sizing drops flex-1 to avoid letterbox. -->
      <div
        class="flex min-h-0 p-2"
        :class="bodyAspect == null && !maximized ? 'flex-1' : ''"
        :style="
          bodyAspect != null && !maximized
            ? { width: '100%', aspectRatio: String(bodyAspect) }
            : maximized
              ? { flex: '1' }
              : undefined
        "
      >
        <slot />
      </div>
      <div
        class="actions invisible absolute top-2 right-2 z-10 flex gap-1 group-focus-within/output:visible group-hover/output:visible"
      >
        <slot name="body-actions" />
      </div>
      <div
        class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <slot name="body-overlay" />
      </div>
    </div>
  </section>
</template>
