<script setup lang="ts">
/**
 * Movable card containing one generation's output. Mirrors
 * FloatingPanel's panel-chrome surface but with freeform drag
 * instead of snap-to-preset, and lives inside LayoutView's workspace
 * transform so zoom scales the window with the canvas. Body slots:
 * default media, `body-actions` (hover toolbar), `body-overlay`
 * (status UI like progress + cancel).
 */
import { useEventListener } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const {
  width = 512,
  // Fallback before an image lands. Once `bodyAspect` is supplied,
  // the section auto-sizes from header + body.
  height = 560,
  title,
  menuEntries = [],
  initialPosition,
  zIndex,
  bodyAspect
} = defineProps<{
  width?: number
  height?: number
  /** Header label; falls back to an i18n default for skeleton windows. */
  title?: string
  /** Appended below the internal Maximize / Restore entry. */
  menuEntries?: MenuItem[]
  /** Workspace-coord starting position. Drag is local; parents that
   *  need committed position listen for `update:position`. */
  initialPosition?: { x: number; y: number }
  zIndex?: number
  /** `naturalWidth / naturalHeight`. When set, the body uses CSS
   *  `aspect-ratio` and the section auto-sizes — uniform 8px margin
   *  regardless of image dimensions. */
  bodyAspect?: number
}>()

const emit = defineEmits<{
  'update:position': [position: { x: number; y: number }]
  promote: []
}>()

const collapsed = ref(false)
const maximized = ref(false)
function toggleCollapsed() {
  collapsed.value = !collapsed.value
}
function toggleMaximized() {
  maximized.value = !maximized.value
}

const appModeStore = useAppModeStore()
const { viewportScale } = storeToRefs(appModeStore)

// Drag snap pitch. Independent of the chrome's outer margin (handled
// in CSS via --spacing-layout-outer); just controls how committal the
// drag feel is in the workspace.
const GRID = 16
const snap = (v: number) => Math.round(v / GRID) * GRID

const wx = ref(0)
const wy = ref(0)
const dragging = ref(false)

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

// External position updates sync into local refs, but skipped while
// dragging so we don't fight the user's pointer with stale values.
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

function handleHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  emit('promote')
  if (maximized.value) return
  // Stop bubbling so LayoutView's pan handler doesn't also fire.
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = { px: e.clientX, py: e.clientY, bx: wx.value, by: wy.value }
  dragging.value = true
}

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  // Divide by scale so the cursor stays stuck to the header at any
  // zoom (pointer is screen px; window position is workspace px).
  // Snap during the drag (not just on release) so the window steps
  // visibly in GRID increments — matches the chrome's gutter between
  // buttons, so adjacent windows can be aligned cleanly by eye.
  const s = viewportScale.value || 1
  wx.value = snap(dragStart.bx + (e.clientX - dragStart.px) / s)
  wy.value = snap(dragStart.by + (e.clientY - dragStart.py) / s)
})

function endDrag() {
  if (dragStart) {
    wx.value = snap(wx.value)
    wy.value = snap(wy.value)
    emit('update:position', { x: wx.value, y: wy.value })
  }
  dragStart = null
  dragging.value = false
}
useEventListener(window, 'pointerup', endDrag)
useEventListener(window, 'pointercancel', endDrag)

const HEADER_CONTROL_CLASS =
  'inline-flex size-8 cursor-pointer items-center justify-center ' +
  'rounded-md border-0 bg-transparent text-layout-text ' +
  'transition-colors duration-layout ease-layout ' +
  'hover:bg-layout-cell-hover focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-base-foreground/40 ' +
  '[&>i]:size-[18px]'

// Maximize / Restore is OutputWindow-owned and merged with the
// parent's menuEntries so the ellipsis is one menu, not two.
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
            // translate3d keeps drag on the compositor instead of
            // running through layout + paint each pointermove —
            // matters mid-run when the latent preview is also
            // repainting on the main thread. The `0` forces a 3D
            // layer up-front rather than promoting on first move.
            transform: `translate3d(${wx}px, ${wy}px, 0)`,
            width: `${width}px`,
            zIndex: zIndex ?? 30,
            // Drop fixed height when collapsed or when bodyAspect
            // drives the body via CSS aspect-ratio.
            ...(collapsed || bodyAspect != null
              ? {}
              : { height: `${height}px` })
          }
    "
  >
    <header
      :class="[
        'flex min-h-layout-cell items-center gap-2 select-none',
        'bg-(--color-layout-header-fill) px-[10px] py-2',
        'border-b border-white/8',
        maximized ? 'cursor-default' : 'cursor-grab touch-none',
        !maximized && dragging && 'cursor-grabbing'
      ]"
      @pointerdown="handleHeaderPointerDown"
    >
      <button
        v-if="!maximized"
        type="button"
        data-header-control
        :class="HEADER_CONTROL_CLASS"
        :aria-expanded="!collapsed"
        @pointerdown.stop
        @click="toggleCollapsed"
      >
        <i
          :class="
            collapsed
              ? 'icon-[lucide--chevron-right]'
              : 'icon-[lucide--chevron-down]'
          "
        />
      </button>
      <span class="truncate text-layout-md font-semibold text-layout-text">
        {{ title || t('linearMode.outputs.title') }}
      </span>
      <div class="min-w-0 flex-1" />
      <slot name="header-actions-right" />
      <Popover
        :entries="combinedMenuEntries"
        :show-arrow="false"
        to="body"
        class="min-w-44 p-1"
      >
        <template #button>
          <button
            type="button"
            data-header-control
            :class="HEADER_CONTROL_CLASS"
            @pointerdown.stop
          >
            <i class="icon-[lucide--ellipsis]" />
          </button>
        </template>
      </Popover>
    </header>
    <div
      v-show="!collapsed"
      class="group/output relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <!-- p-2 = uniform 8px media margin. With `bodyAspect`, the
           wrapper sizes via aspect-ratio (drops flex-1) for no letterbox. -->
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
