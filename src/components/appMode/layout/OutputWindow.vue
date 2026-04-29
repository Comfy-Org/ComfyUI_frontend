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
  // Fallback before an image lands; bodyAspect takes over once known.
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
  /** Workspace-coord starting position. Listen for `update:position` for committed values. */
  initialPosition?: { x: number; y: number }
  /** User-set dimensions; emit via `update:size`. Either being set
   *  switches off bodyAspect content-fit. */
  initialWidth?: number
  initialHeight?: number
  zIndex?: number
  /** `naturalWidth / naturalHeight`; when set (and user hasn't resized),
   *  body uses CSS aspect-ratio. */
  bodyAspect?: number
}>()

const emit = defineEmits<{
  'update:position': [position: { x: number; y: number }]
  'update:size': [size: { width: number; height: number }]
  promote: []
}>()

// True once the user resizes — switches off bodyAspect auto-fit.
const userSized = computed(() => initialWidth != null || initialHeight != null)

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
const ww = ref(initialWidth ?? defaultWidth)
const wh = ref(initialHeight ?? defaultHeight)

onMounted(() => {
  if (initialPosition) {
    wx.value = snap(initialPosition.x)
    wy.value = snap(initialPosition.y)
    return
  }
  // No initial position → center in the viewport.
  wx.value = snap(Math.max(0, (window.innerWidth - ww.value) / 2))
  wy.value = snap(Math.max(0, (window.innerHeight - wh.value) / 2 - 32))
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

// Min width = title's natural width + chrome budget (chevron, gaps,
// download, ellipsis, padding) so the filename never truncates.
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
  /** Section width minus the body's interior width (= 2 × body padding). */
  chromeW: number
  /** Section height minus the body's interior height (header + 2 × padding). */
  chromeH: number
  dir: ResizeDir
}
let resizeStart: ResizeStart | null = null
const activeDir = ref<ResizeDir | null>(null)

const BODY_PAD_PX = 8

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
      // Sample actual rendered dimensions (wh.value is the default
      // until first resize and doesn't match aspect-fit on screen).
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

      // Aspect-lock targets the BODY's interior so the image's margins
      // stay even on all sides (header + padding eat chrome from the
      // section dimensions but not from the body the image fills).
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

      // Clamp; aspect-lock holds across the clamp via the body interior.
      const minW = minWidth.value
      if (nw_ < minW) {
        nw_ = minW
        if (bodyAspect != null) nh_ = (nw_ - chromeW) / bodyAspect + chromeH
      }
      if (nh_ < MIN_HEIGHT_PX) {
        nh_ = MIN_HEIGHT_PX
        if (bodyAspect != null) nw_ = (nh_ - chromeH) * bodyAspect + chromeW
      }

      // Anchor the OPPOSITE corner — edges default the implicit axis
      // to top/left so only the dragged edge visibly moves.
      const anchorEast = left
      const anchorSouth = top
      const nx = anchorEast ? bx + bw - nw_ : bx
      const ny = anchorSouth ? by + bh - nh_ : by

      ww.value = snap(nw_)
      wh.value = snap(nh_)
      wx.value = snap(nx)
      wy.value = snap(ny)
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
    ref="sectionRef"
    class="panel-chrome floating-panel pointer-events-auto absolute flex flex-col overflow-hidden"
    :style="
      maximized
        ? { inset: '0px', zIndex: zIndex ?? 30 }
        : {
            // translate3d keeps drag on the compositor; the trailing 0
            // forces an upfront 3D layer instead of first-move promotion.
            transform: `translate3d(${wx}px, ${wy}px, 0)`,
            width: `${ww}px`,
            zIndex: zIndex ?? 30,
            ...(collapsed
              ? {}
              : userSized || bodyAspect == null
                ? { height: `${wh}px` }
                : {})
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
      <!-- bodyAspect drives auto-fit only when the user hasn't resized. -->
      <div
        class="flex min-h-0 p-2"
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
    <!-- Resize hit-zones: 6px edges and 12px corners. Cursor is the
         only affordance; corners stack above edges so the diagonal
         cursor wins in the overlap. -->
    <template v-if="!maximized && !collapsed">
      <div
        data-resize-dir="n"
        class="absolute inset-x-3 -top-1 z-30 h-1.5 cursor-n-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="s"
        class="absolute inset-x-3 -bottom-1 z-30 h-1.5 cursor-s-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="e"
        class="absolute inset-y-3 -right-1 z-30 w-1.5 cursor-e-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="w"
        class="absolute inset-y-3 -left-1 z-30 w-1.5 cursor-w-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="nw"
        class="absolute -top-1 -left-1 z-40 size-3 cursor-nw-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="ne"
        class="absolute -top-1 -right-1 z-40 size-3 cursor-ne-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="sw"
        class="absolute -bottom-1 -left-1 z-40 size-3 cursor-sw-resize"
        @pointerdown="handleResizePointerDown"
      />
      <div
        data-resize-dir="se"
        class="group/resize absolute -right-1 -bottom-1 z-40 size-3 cursor-se-resize"
        @pointerdown="handleResizePointerDown"
      >
        <!-- Visible cue on the SE corner only — three-pip stack. -->
        <div
          :class="[
            'pointer-events-none absolute right-1 bottom-1 size-1.5 rounded-full bg-base-foreground/30',
            'opacity-0 transition-opacity duration-150',
            'group-hover/resize:opacity-100',
            resizing && 'opacity-100'
          ]"
        />
      </div>
    </template>
  </section>
</template>
