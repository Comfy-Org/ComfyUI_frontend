<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import { useWorkspacePanZoom } from '@/components/appMode/layout/panels/useWorkspacePanZoom'
import { useAppMode } from '@/composables/useAppMode'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const settingStore = useSettingStore()
const { viewportScale, viewportOffsetX, viewportOffsetY } =
  storeToRefs(appModeStore)

// Reserve the backdrop gutter on whichever side the user has the
// global sidebar pinned so the dotted-grid doesn't slide under it.
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') !== 'right'
)

const bgRef = useTemplateRef<HTMLElement>('bgRef')

// Backdrop is the full pan/zoom hit-target; no internal scroll regions
// to gate on. Abandon on blur because pointerup may never arrive after
// an alt-tab during a drag.
const { handleWheel, handlePointerDown } = useWorkspacePanZoom({
  surfaceRef: bgRef,
  abandonOnBlur: true
})

const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

const DOT_SIZE_PX = 24
const MIN_GRID_SPACING_PX = 16
// LOD-double the pitch so the grid doesn't collapse into noise.
const gridSpacing = computed(() => {
  let s = DOT_SIZE_PX * viewportScale.value
  if (!(s > 0)) return DOT_SIZE_PX
  while (s < MIN_GRID_SPACING_PX) s *= 2
  return s
})
</script>

<template>
  <!-- z-50 above graph canvas, below AppChrome / FloatingPanel / toolbar.
       Pan/zoom handlers live on the full-viewport backdrop (not the
       transformed inner workspace) so a panned workspace doesn't leave
       a dead zone where new pan/zoom gestures can't start. -->
  <div
    v-if="isArrangeMode"
    :class="
      cn(
        'builder-backdrop fixed z-50 overflow-hidden',
        'top-(--workflow-tabs-height) bottom-0',
        sidebarOnLeft
          ? 'right-0 left-(--sidebar-width,0px)'
          : 'right-(--sidebar-width,0px) left-0',
        'bg-layout-canvas',
        'bg-[radial-gradient(circle,var(--color-layout-grid-dot)_1px,transparent_1.5px)]'
      )
    "
    :style="{
      backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
      backgroundPosition: `${viewportOffsetX}px ${viewportOffsetY}px`
    }"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @dragstart.prevent
  >
    <div
      ref="bgRef"
      class="builder-backdrop__workspace absolute inset-0 flex flex-col"
      :style="{ transform: workspaceTransform }"
    >
      <LinearPreview hide-chrome />
    </div>
  </div>
</template>

<!-- :deep(*) override; documented exception in docs/guidance/vue-components.md. -->
<style scoped>
.builder-backdrop :deep(*) {
  pointer-events: auto;
}
.builder-backdrop__workspace {
  pointer-events: auto;
  transform-origin: center;
  user-select: none;
  -webkit-user-drag: none;
}
.builder-backdrop__workspace :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>
