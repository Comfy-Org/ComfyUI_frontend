<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

import { usePointerDrag } from './panels/usePointerDrag'
import PanelHeader from './PanelHeader.vue'

const { t } = useI18n()
const {
  defaultWidth = 512,
  defaultHeight = 560,
  title,
  menuEntries = [],
  initialPosition,
  initialWidth,
  initialHeight,
  zIndex,
  bodyAspect
} = defineProps<{
  defaultWidth?: number
  defaultHeight?: number
  title?: string
  /** Appended below the internal Maximize / Restore entry. */
  menuEntries?: MenuItem[]
  /** Workspace-coord starting position. */
  initialPosition?: { x: number; y: number }
  /** User-set dimensions; switches off bodyAspect content-fit. */
  initialWidth?: number
  initialHeight?: number
  zIndex?: number
  /** `naturalWidth / naturalHeight`; drives content-fit if user hasn't resized. */
  bodyAspect?: number
}>()

const emit = defineEmits<{
  'update:position': [position: { x: number; y: number }]
  'update:size': [size: { width: number; height: number }]
  promote: []
}>()

const userSized = computed(() => initialWidth != null || initialHeight != null)

// TODO: maximize-to-workspace is buggy — UI removed but state +
// toggle handler kept so we can re-add the menu entry once fixed:
//   { icon: 'icon-[lucide--maximize] size-[18px]',
//     label: t('linearMode.outputs.maximize'),
//     command: _toggleMaximized }
// (rename back to `toggleMaximized` when re-wired.)
const maximized = ref(false)
function _toggleMaximized() {
  maximized.value = !maximized.value
}
void _toggleMaximized

const appModeStore = useAppModeStore()
const { viewportScale, noZoomMode } = storeToRefs(appModeStore)

// In dashboard mode, small auto-placed tiles drop the header — the
// filename is unreadable at thumbnail size and the drag-handle role
// is moot when tiles can't be moved by hand. Zoom mode keeps the
// header at every size.
// TODO: surface download/close/menu via a hover overlay on
// headerless tiles so those actions stay reachable.
const HEADERLESS_THRESHOLD_W = 360
const HEADERLESS_THRESHOLD_H = 300

// Snap to the chrome cell grid in every mode so tiles line up with
// the input panel and chrome corner clusters. Positions sit at
// outer + N·step (8, 64, 120, ...); sizes are N·step − gutter (48,
// 104, 160, ...) so adjacent tiles' gutters fall on a chrome edge.
const CHROME_OUTER = 8
const CHROME_GUTTER = 8
const CHROME_STEP = 56
const snapPos = (v: number) =>
  Math.round((v - CHROME_OUTER) / CHROME_STEP) * CHROME_STEP + CHROME_OUTER
const snapSize = (v: number) => {
  const cells = Math.max(1, Math.round((v + CHROME_GUTTER) / CHROME_STEP))
  return cells * CHROME_STEP - CHROME_GUTTER
}

// Initialize from the spawn coordinate so the first paint already has
// the right transform — no (0,0) flash before onMounted.
const wx = ref(initialPosition?.x ?? 0)
const wy = ref(initialPosition?.y ?? 0)
const ww = ref(initialWidth ?? defaultWidth)
const wh = ref(initialHeight ?? defaultHeight)

onMounted(() => {
  if (initialPosition) return
  wx.value = snapPos(Math.max(0, (window.innerWidth - ww.value) / 2))
  wy.value = snapPos(Math.max(0, (window.innerHeight - wh.value) / 2 - 32))
})

// Skip while dragging so the pointer wins over stale prop values.
watch(
  () => initialPosition,
  (next) => {
    if (!next || dragging.value) return
    if (next.x === wx.value && next.y === wy.value) return
    wx.value = next.x
    wy.value = next.y
  }
)
watch(
  () => [initialWidth, initialHeight],
  ([nw, nh]) => {
    if (resizing.value) return
    if (nw != null && nw !== ww.value) ww.value = nw
    if (nh != null && nh !== wh.value) wh.value = nh
  }
)

let dragStart: { px: number; py: number; bx: number; by: number } | null = null

const { isDragging: dragging, start: handleHeaderPointerDown } = usePointerDrag(
  {
    stopPropagation: true,
    onStart: (e) => {
      if (e.button !== 0) return false
      // Promote even when maximized; only drag is gated.
      emit('promote')
      if (maximized.value) return false
      dragStart = { px: e.clientX, py: e.clientY, bx: wx.value, by: wy.value }
    },
    onMove: (e) => {
      if (!dragStart) return
      // Divide by scale: pointer is screen px, position is workspace px.
      const s = viewportScale.value || 1
      wx.value = snapPos(dragStart.bx + (e.clientX - dragStart.px) / s)
      wy.value = snapPos(dragStart.by + (e.clientY - dragStart.py) / s)
    },
    onCommit: () => {
      emit('update:position', { x: wx.value, y: wy.value })
    },
    onReset: () => {
      dragStart = null
    }
  }
)

// Min width = title's natural width + chrome budget so filename can't truncate.
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const HEADER_CHROME_BUDGET_PX = 140
const MIN_HEIGHT_PX = 80
const minWidth = computed(() => {
  const titleEl = sectionRef.value?.querySelector<HTMLElement>(
    'header span[class*="truncate"]'
  )
  const titleNatural = titleEl?.scrollWidth ?? 0
  return Math.max(240, titleNatural + HEADER_CHROME_BUDGET_PX)
})

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type ResizeStart = {
  px: number
  py: number
  bx: number
  by: number
  bw: number
  bh: number
  chromeW: number
  chromeH: number
  dir: ResizeDir
}
let resizeStart: ResizeStart | null = null
const activeDir = ref<ResizeDir | null>(null)

const BODY_PAD_PX = 0

const { isDragging: resizing, start: handleResizePointerDown } = usePointerDrag(
  {
    stopPropagation: true,
    onStart: (e) => {
      if (e.button !== 0) return false
      emit('promote')
      if (maximized.value) return false
      const dir = (e.currentTarget as HTMLElement).dataset.resizeDir as
        | ResizeDir
        | undefined
      if (!dir) return false
      activeDir.value = dir
      // wh.value is the default before first resize; sample the rendered rect.
      const s = viewportScale.value || 1
      const sectionEl = sectionRef.value
      const rectH = sectionEl?.getBoundingClientRect().height
      const startH = rectH ? rectH / s : wh.value
      const headerH =
        sectionEl?.querySelector<HTMLElement>('header')?.offsetHeight
      const chromeH = (headerH ?? 48) + 2 * BODY_PAD_PX
      const chromeW = 2 * BODY_PAD_PX
      resizeStart = {
        px: e.clientX,
        py: e.clientY,
        bx: wx.value,
        by: wy.value,
        bw: ww.value,
        bh: startH,
        chromeW,
        chromeH,
        dir
      }
    },
    onMove: (e) => {
      if (!resizeStart) return
      const s = viewportScale.value || 1
      const dx = (e.clientX - resizeStart.px) / s
      const dy = (e.clientY - resizeStart.py) / s
      const { dir, bx, by, bw, bh, chromeW, chromeH } = resizeStart
      const right = dir.includes('e')
      const left = dir.includes('w')
      const bottom = dir.includes('s')
      const top = dir.includes('n')

      let nw_ = bw + (right ? dx : left ? -dx : 0)
      let nh_ = bh + (bottom ? dy : top ? -dy : 0)

      // Aspect-lock the BODY interior, not the section, so image
      // margins stay even on all sides.
      if (bodyAspect != null) {
        const widthChanged = right || left
        const heightChanged = top || bottom
        const useWidth =
          widthChanged && heightChanged
            ? Math.abs(nw_ - bw) >= Math.abs(nh_ - bh) * bodyAspect
            : widthChanged
        if (useWidth) {
          const bodyW = Math.max(0, nw_ - chromeW)
          nh_ = bodyW / bodyAspect + chromeH
        } else {
          const bodyH = Math.max(0, nh_ - chromeH)
          nw_ = bodyH * bodyAspect + chromeW
        }
      }

      const minW = minWidth.value
      if (nw_ < minW) {
        nw_ = minW
        if (bodyAspect != null) nh_ = (nw_ - chromeW) / bodyAspect + chromeH
      }
      if (nh_ < MIN_HEIGHT_PX) {
        nh_ = MIN_HEIGHT_PX
        if (bodyAspect != null) nw_ = (nh_ - chromeH) * bodyAspect + chromeW
      }

      // Anchor the diagonally-opposite corner.
      const anchorEast = left
      const anchorSouth = top
      const nx = anchorEast ? bx + bw - nw_ : bx
      const ny = anchorSouth ? by + bh - nh_ : by

      ww.value = snapSize(nw_)
      wh.value = snapSize(nh_)
      wx.value = snapPos(nx)
      wy.value = snapPos(ny)
    },
    onCommit: () => {
      emit('update:size', { width: ww.value, height: wh.value })
      emit('update:position', { x: wx.value, y: wy.value })
    },
    onReset: () => {
      resizeStart = null
      activeDir.value = null
    }
  }
)

const showHeader = computed(() => {
  if (!noZoomMode.value || maximized.value) return true
  return (
    ww.value >= HEADERLESS_THRESHOLD_W && wh.value >= HEADERLESS_THRESHOLD_H
  )
})
</script>

<template>
  <section
    ref="sectionRef"
    class="panel-chrome floating-panel pointer-events-auto absolute flex flex-col overflow-hidden"
    :style="
      maximized
        ? { inset: '0px', zIndex: zIndex ?? 30 }
        : {
            // translate3d keeps drag on the compositor.
            transform: `translate3d(${wx}px, ${wy}px, 0)`,
            width: `${ww}px`,
            zIndex: zIndex ?? 30,
            ...(userSized || bodyAspect == null ? { height: `${wh}px` } : {})
          }
    "
  >
    <PanelHeader
      v-if="showHeader"
      :title="title || t('linearMode.outputs.title')"
      :draggable="!maximized"
      :dragging="dragging"
      :collapsible="false"
      :menu-entries="menuEntries"
      :menu-label="t('linearMode.floatingPanel.menu')"
      @pointerdown="handleHeaderPointerDown"
    >
      <template #leading>
        <slot name="header-actions-left" />
      </template>
      <template #actions>
        <slot name="header-actions-right" />
      </template>
    </PanelHeader>
    <div
      class="group/output relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <!-- bodyAspect drives auto-fit only when the user hasn't resized. -->
      <div
        class="flex min-h-0"
        :class="(bodyAspect == null || userSized) && !maximized ? 'flex-1' : ''"
        :style="
          bodyAspect != null && !userSized && !maximized
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
    <!-- Resize hit-zones — corners (z-40) stack above edges (z-30).
         Zones are 12px (edges) and 20px (corners), centered across
         the tile edge so half is inside the tile and half overhangs;
         this widens the click target without making the visible
         border feel thicker. -->
    <template v-if="!maximized">
      <div
        data-resize-dir="n"
        class="absolute inset-x-5 -top-1.5 z-30 h-3 cursor-n-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="s"
        class="absolute inset-x-5 -bottom-1.5 z-30 h-3 cursor-s-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="e"
        class="absolute inset-y-5 -right-1.5 z-30 w-3 cursor-e-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="w"
        class="absolute inset-y-5 -left-1.5 z-30 w-3 cursor-w-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="nw"
        class="absolute -top-2 -left-2 z-40 size-5 cursor-nw-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="ne"
        class="absolute -top-2 -right-2 z-40 size-5 cursor-ne-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="sw"
        class="absolute -bottom-2 -left-2 z-40 size-5 cursor-sw-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="se"
        class="group/resize absolute -right-2 -bottom-2 z-40 size-5 cursor-se-resize"
        @pointerdown="handleResizePointerDown"
      >
        <!-- Visible cue on the SE corner. -->
        <div
          :class="[
            'pointer-events-none absolute right-2 bottom-2 size-1.5 rounded-full bg-base-foreground/30',
            'opacity-0 transition-opacity duration-150',
            'group-hover/resize:opacity-100',
            resizing && 'opacity-100'
          ]"
        />
      </div>
    </template>
  </section>
</template>
