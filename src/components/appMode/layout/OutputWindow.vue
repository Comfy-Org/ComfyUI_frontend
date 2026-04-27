<script setup lang="ts">
/**
 * OutputWindow — movable card containing one generation's output
 * (skeleton / latent / final image, in that order via crossfade).
 *
 * Visually mirrors FloatingPanel (panel-chrome surface, header
 * layout: chevron / title / menu) but with freeform drag instead
 * of snap-to-preset. Lives inside LayoutView's workspace transform
 * so zoom scales the window with the rest of the canvas.
 *
 * Header layout (left → right):
 *   chevron · title · `header-actions-right` slot · maximize · ellipsis
 *
 * - Chevron collapses the body (header-only when collapsed).
 * - Title is a freeform string (consumers typically pass the asset
 *   filename so it doubles as the file label).
 * - `header-actions-right` slot — always-visible per-window actions
 *   that read against the panel chrome (e.g. download). Sits at the
 *   left of the right-side cluster. Use the transparent /
 *   hover-tinted style of the other header controls.
 * - Hover toolbar at body's top-right (slot `body-actions`) holds
 *   the secondary actions (rerun / reuse-params) — only visible
 *   while hovering or focusing the body, so the image surface
 *   stays clean.
 * - Ellipsis menu wires a Popover from `menuEntries` for tertiary
 *   actions (close, clear all, etc).
 *
 * Body content gets a uniform 8px margin via `p-2` on the slot
 * wrapper, so the image breathes against the panel edges
 * regardless of its dimensions. The `body-actions` /
 * `body-overlay` slots intentionally sit outside that wrapper so
 * they stay anchored 8px from the panel's corners (not 16px).
 */
import { useEventListener } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const {
  width = 512,
  // Default height applies before an image lands (skeleton / latent
  // previews). Once `bodyAspect` is supplied the section auto-sizes
  // to header + body and this value isn't used.
  height = 560,
  title,
  menuEntries = [],
  initialPosition,
  zIndex,
  bodyAspect
} = defineProps<{
  width?: number
  height?: number
  /** Header label. Free-form — for App Mode windows we pass the
   *  asset filename so the header doubles as the file label. Falls
   *  back to a generic i18n default when undefined (skeleton /
   *  latent windows that don't yet have a file). */
  title?: string
  /** Entries for the header ellipsis Popover. When empty the ellipsis
   *  button is hidden so the header reads as "no extra actions" rather
   *  than "menu with nothing in it". */
  menuEntries?: MenuItem[]
  /** Workspace-coord starting position. When omitted the window
   *  centers itself in the viewport (single-window legacy behavior).
   *  Drag is still local — parents that need final position can
   *  listen for `update:position`. */
  initialPosition?: { x: number; y: number }
  /** Stack order. Defaults to `30` to match the old single-window
   *  layer; multi-window callers pass per-window values from a
   *  promote-on-focus store. */
  zIndex?: number
  /** Image aspect ratio (`naturalWidth / naturalHeight`). When
   *  supplied, the body wrapper uses CSS `aspect-ratio` so the
   *  rendered media exactly fills the padded box — no
   *  object-contain letterbox — and the section auto-sizes
   *  vertically to header + body. Uniform 8px margin on every
   *  side regardless of image dimensions. */
  bodyAspect?: number
}>()

const emit = defineEmits<{
  'update:position': [position: { x: number; y: number }]
  promote: []
}>()

const collapsed = ref(false)
function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

// Maximize: window expands to fill the workspace (inset: 0), giving
// the image the whole canvas like the pre-window full-viewport hero.
// Position/size are preserved so toggling back returns to the same
// spot. Drag + collapse are no-ops while maximized.
const maximized = ref(false)
function toggleMaximized() {
  maximized.value = !maximized.value
}

const appModeStore = useAppModeStore()
const { viewportScale } = storeToRefs(appModeStore)

// Snap pitch — finer than the visible dot grid (24px) so even small
// drags snap to a clean increment for alignment, while staying coarse
// enough that the snap feels intentional rather than the cursor
// fighting the user.
const GRID = 8
const snap = (v: number) => Math.round(v / GRID) * GRID

const wx = ref(0)
const wy = ref(0)
const dragging = ref(false)

onMounted(() => {
  if (initialPosition) {
    // Multi-window mode: parent assigns workspace coords (cascade,
    // moodboard layout, etc). Snap them so they sit on the same grid
    // drag uses, regardless of how the parent computed them.
    wx.value = snap(initialPosition.x)
    wy.value = snap(initialPosition.y)
    return
  }
  // Single-window legacy: roughly screen-center in workspace coords.
  // Holds at scale=1 / no pan; if the user has zoomed/panned away
  // before the window appears it'll land wherever the corresponding
  // workspace coord lives — they can drag it.
  wx.value = snap(Math.max(0, (window.innerWidth - width) / 2))
  wy.value = snap(Math.max(0, (window.innerHeight - height) / 2 - 32))
})

// External position updates (e.g. parent moves a window programmatically
// while it's mounted) sync into the local refs. Skipped while dragging
// so we don't fight the user's pointer with stale store values.
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
  // Promote-on-focus fires regardless of maximized state — clicking
  // the header should always raise the window in multi-window stacks.
  emit('promote')
  // Drag is disabled while maximized — there's nowhere to drag to.
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
  // Pointer moves in screen px; window position is workspace px.
  // Divide by scale so the cursor stays "stuck" to the header
  // regardless of zoom level.
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
  'hover:bg-layout-cell-hover [&>i]:size-[18px]'
</script>

<template>
  <section
    class="panel-chrome floating-panel pointer-events-auto absolute flex flex-col overflow-hidden"
    :style="
      maximized
        ? { inset: '0px', zIndex: zIndex ?? 30 }
        : {
            left: `${wx}px`,
            top: `${wy}px`,
            width: `${width}px`,
            zIndex: zIndex ?? 30,
            // - Collapsed: drop height so section shrinks to header.
            // - bodyAspect set: drop height so section auto-sizes to
            //   header + body (body sizes itself via aspect-ratio).
            // - Otherwise (skeleton/latent without aspect): fixed
            //   height fallback.
            ...(collapsed || bodyAspect != null
              ? {}
              : { height: `${height}px` })
          }
    "
  >
    <!-- Header strip mirrors FloatingPanel: chevron / title / menu,
         the strip itself is the drag grip. Buttons stop propagation
         so clicking them doesn't start a drag. -->
    <header
      :class="[
        'flex min-h-layout-cell items-center gap-2 select-none',
        'bg-(--color-layout-header-fill) px-[10px] py-2',
        // 1px hairline at the header→body seam, matching the chrome
        // family alpha (panel chrome + cells + widget outlines all at
        // rgb 255/255/255/0.08).
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
      <button
        type="button"
        data-header-control
        :class="HEADER_CONTROL_CLASS"
        :aria-pressed="maximized"
        :title="
          maximized
            ? t('linearMode.outputs.restore')
            : t('linearMode.outputs.maximize')
        "
        :aria-label="
          maximized
            ? t('linearMode.outputs.restore')
            : t('linearMode.outputs.maximize')
        "
        @pointerdown.stop
        @click="toggleMaximized"
      >
        <i
          :class="
            maximized ? 'icon-[lucide--minimize]' : 'icon-[lucide--maximize]'
          "
        />
      </button>
      <Popover
        v-if="menuEntries.length > 0"
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
      <!-- Padded inner wrapper gives the slotted media a uniform 8px
           margin against the window edges. When `bodyAspect` is set
           the wrapper sizes itself via CSS `aspect-ratio` (and
           drops `flex-1` so it doesn't fight the section's auto
           height). With aspect = image's natural ratio, `size-full`
           children fill the padded box exactly — no letterbox, equal
           margins on every side regardless of image dimensions. -->
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
      <!-- Hover-revealed action toolbar — graph-view style: top-right
           inside the body, light pill buttons against image content,
           hidden by default to keep the surface clean. Slot empty by
           default so the toolbar collapses out of layout when no host
           wants to mount actions. -->
      <div
        class="actions invisible absolute top-2 right-2 z-10 flex gap-1 group-focus-within/output:visible group-hover/output:visible"
      >
        <slot name="body-actions" />
      </div>
      <!-- Centered status overlay — host slots run-state UI here
           (progress / cancel) so that work-in-flight feedback lives
           on the image instead of in flickering chrome cells. The
           wrapper itself is pointer-events-none so empty space passes
           clicks through; consumer turns events back on for the
           interactive card. -->
      <div
        class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <slot name="body-overlay" />
      </div>
    </div>
  </section>
</template>
