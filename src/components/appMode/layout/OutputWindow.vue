<script setup lang="ts">
/**
 * OutputWindow — movable card containing one generation's output.
 * Visually mirrors FloatingPanel's panel-chrome surface but with
 * freeform drag instead of snap-to-preset. Lives inside LayoutView's
 * workspace transform so zoom scales the window with the canvas.
 *
 * Header layout: chevron · title · `header-actions-right` slot ·
 * ellipsis. The ellipsis Popover combines an internal Maximize /
 * Restore entry with the parent-supplied `menuEntries`.
 *
 * Body slots:
 * - default: media (skeleton / latent / image) — wrapped in `p-2`
 *   for uniform 8px margin against the window edges.
 * - `body-actions`: hover-revealed action toolbar (top-right of the
 *   body, light-on-dark style) for actions that read against image
 *   content.
 * - `body-overlay`: centered, host-driven status UI (progress /
 *   cancel). Wrapper is pointer-events-none; consumers turn events
 *   back on for the interactive card.
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
  // Used only as a fallback before an image lands. Once `bodyAspect`
  // is supplied the section auto-sizes to header + body.
  height = 560,
  title,
  menuEntries = [],
  initialPosition,
  zIndex,
  bodyAspect
} = defineProps<{
  width?: number
  height?: number
  /** Header label. Falls back to a generic i18n default when
   *  undefined (skeleton / latent windows that don't yet have a
   *  file). */
  title?: string
  /** Extra entries for the header ellipsis Popover, appended below
   *  the internal Maximize / Restore entry. */
  menuEntries?: MenuItem[]
  /** Workspace-coord starting position. When omitted the window
   *  centers itself (single-window legacy). Drag is local; parents
   *  that need final position listen for `update:position`. */
  initialPosition?: { x: number; y: number }
  zIndex?: number
  /** Image aspect ratio (`naturalWidth / naturalHeight`). When set,
   *  the body wrapper uses CSS `aspect-ratio` and the section
   *  auto-sizes vertically — uniform 8px margin on every side
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

// Snap pitch — finer than the visible dot grid (24px) so even small
// drags snap cleanly while staying coarse enough to feel intentional.
const GRID = 8
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
  // Stop bubbling so LayoutView's bgRef pan handler doesn't also
  // start a workspace pan from this same press.
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = { px: e.clientX, py: e.clientY, bx: wx.value, by: wy.value }
  dragging.value = true
}

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  // Pointer moves are screen px; window position is workspace px.
  // Divide by scale so the cursor stays "stuck" to the header at
  // any zoom.
  const s = viewportScale.value || 1
  wx.value = dragStart.bx + (e.clientX - dragStart.px) / s
  wy.value = dragStart.by + (e.clientY - dragStart.py) / s
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

// Maximize / Restore is OutputWindow-owned (state lives here) and
// merged with parent's `menuEntries` so the ellipsis is a single
// menu rather than two competing UIs.
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
            // Position via translate3d (compositor-only) instead of
            // top/left (layout + paint). Updating top/left every
            // pointermove during a drag shares the main thread with
            // the latent-preview decode, which is what made dragging
            // an OutputWindow feel laggy mid-run. transform keeps the
            // move on the GPU, freeing main-thread budget. The `0`
            // forces a 3D layer so the browser allocates a composite
            // layer up-front rather than promoting on first move.
            transform: `translate3d(${wx}px, ${wy}px, 0)`,
            width: `${width}px`,
            zIndex: zIndex ?? 30,
            // Drop height when collapsed (header-only) or when
            // bodyAspect is set (section auto-sizes from header +
            // aspect-driven body). Otherwise use the fixed fallback.
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
      <!-- p-2 wrapper gives the slotted media a uniform 8px margin
           against the window edges. With `bodyAspect` set, the
           wrapper sizes itself via CSS aspect-ratio (and drops
           flex-1) so the slot fills exactly — no letterbox. -->
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
