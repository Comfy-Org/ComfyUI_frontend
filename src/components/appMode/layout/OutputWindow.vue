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
 * Chrome layout mirrors graph view's image-output node:
 * - Chevron collapses the body (header-only when collapsed).
 * - Hover toolbar at body's top-right (slot `body-actions`) holds
 *   the primary actions (rerun / reuse-params / download) — only
 *   visible while hovering or focusing the body, so the image
 *   surface stays clean.
 * - Ellipsis menu wires a Popover from `menuEntries` for secondary
 *   actions (download all, delete all, etc).
 * - Optional filename strip below the body for the asset label.
 */
import { useEventListener } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const {
  width = 512,
  height = 568,
  title,
  filename,
  menuEntries = []
} = defineProps<{
  width?: number
  height?: number
  /** Header label. Pass the source output node's title (e.g. "Save
   *  Image", "Save Video", or a user-renamed node) so the window
   *  reads as the same surface as the graph-view image-output node.
   *  Falls back to a generic i18n default when undefined. */
  title?: string
  /** Asset filename rendered in the small footer strip below the body
   *  (mirrors graph view's gallery-mode label). Strip hides when
   *  undefined. */
  filename?: string
  /** Entries for the header ellipsis Popover. When empty the ellipsis
   *  button is hidden so the header reads as "no extra actions" rather
   *  than "menu with nothing in it". */
  menuEntries?: MenuItem[]
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
  // Initial position: roughly screen-center in workspace coords.
  // Holds at scale=1 / no pan; if the user has zoomed/panned away
  // before the window appears it'll land wherever the corresponding
  // workspace coord lives — they can drag it.
  wx.value = snap(Math.max(0, (window.innerWidth - width) / 2))
  wy.value = snap(Math.max(0, (window.innerHeight - height) / 2 - 32))
})

let dragStart: { px: number; py: number; bx: number; by: number } | null = null

function handleHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
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
    class="panel-chrome floating-panel pointer-events-auto absolute z-30 flex flex-col overflow-hidden"
    :style="
      maximized
        ? { inset: '0px' }
        : {
            left: `${wx}px`,
            top: `${wy}px`,
            width: `${width}px`,
            // When collapsed the body / footer hide and the section
            // auto-sizes to header height. Drop the explicit height
            // so the box doesn't keep its full 568px and stay empty.
            ...(collapsed ? {} : { height: `${height}px` })
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
      <slot />
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
    <div
      v-if="!collapsed && filename"
      class="shrink-0 truncate px-3 py-2 text-center text-xs text-base-foreground"
    >
      {{ filename }}
    </div>
  </section>
</template>
