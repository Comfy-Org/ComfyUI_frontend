<script setup lang="ts">
/**
 * LayoutView — App Mode runtime view.
 *
 * Three compositing layers: LinearPreview fills the viewport as the
 * background (the output / welcome canvas); AppChrome overlays the
 * grid-anchored system cells; FloatingPanel overlays the inputs panel.
 *
 * All chrome lives in AppChrome and is shared with the builder —
 * changes there surface in both views by construction. This component
 * owns only the backdrop + the panel.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import AppChrome from './AppChrome.vue'
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import { useAppPanelLayout } from './panels/useAppPanelLayout'

import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getPathDetails } from '@/utils/formatUtil'
import { useAppModeStore } from '@/stores/appModeStore'

const appModeStore = useAppModeStore()
const workflowStore = useWorkflowStore()

// Per-input resolution + block-layout state is shared with the builder
// via useAppPanelLayout — both views read the same `panelRows` from the
// store so WYSIWYG holds across mode switches.
const { inputEntryMap, moveBlock } = useAppPanelLayout()

const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return ''
  return getPathDetails(path).filename
})

// Panel preset + collapse state + block rows live in appModeStore so
// App Mode + App Builder share them; moving / collapsing / rearranging
// in either updates both.
const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)

// Which viewport side the panel is docked against. Used to steer the
// welcome-copy offset so the wordmark + body text stay visible on the
// opposite side of the panel, regardless of preset.
const panelSide = computed(() =>
  panelPreset.value.endsWith('-dock')
    ? panelPreset.value.startsWith('left')
      ? 'left'
      : 'right'
    : panelPreset.value.endsWith('l')
      ? 'left'
      : 'right'
)
</script>

<template>
  <div class="layout-view" :data-panel-side="panelSide">
    <!-- Background layer: output canvas fills the viewport. LinearPreview's
         built-in chrome (top actions + bottom history/feedback) is hidden;
         AppChrome renders the replacements. -->
    <div class="layout-view__background">
      <LinearPreview hide-chrome />
    </div>

    <!-- Chrome layer: floating utility cells. Shared with the builder. -->
    <AppChrome variant="app-mode" />

    <!-- Overlay layer: the floating panel(s). Phase 4-A: one panel;
         Phase 4-C: drag between presets. -->
    <FloatingPanel
      v-model:preset="panelPreset"
      v-model:collapsed="panelCollapsed"
      :title="panelTitle"
      movable
    >
      <PanelBlockList
        :rows="panelRows"
        :input-entry-map="inputEntryMap"
        @reorder="moveBlock"
      />
    </FloatingPanel>
  </div>
</template>

<style scoped>
.layout-view {
  position: absolute;
  inset: 0;
  background-color: var(--color-layout-canvas);
  /* Form-builder dot grid — decorative. Not aligned with chrome-cell
     positions (the dot pitch is a fixed 24px while chrome cells sit
     at 48px cells + 8px gutters). */
  background-image: radial-gradient(
    circle,
    var(--color-layout-grid-dot) 1px,
    transparent 1.5px
  );
  background-size: var(--spacing-layout-dot) var(--spacing-layout-dot);
  background-position: 0 0;
  /* Clip LinearPreview's inner absolute-positioned layers (image,
     skeletons, welcome) so they can never paint above the layout-view
     box — which sits below the top workflow-tabs bar. */
  overflow: hidden;
  /* Own stacking context so our z-indexed children (background, grid,
     panel, drag preview) compose cleanly without reaching outside. */
  isolation: isolate;
  /* Reserve the panel's footprint on whichever viewport side it's docked
     against, so LinearWelcome's body copy stays visible on the opposite
     side. LinearWelcome consumes both vars; the panel-free side is 0
     and the panel side is panel-width + outer-padding. Default to
     right-dock for legacy splitter App Mode where --data-panel-side is
     unset. */
  --welcome-panel-offset-left: 0;
  --welcome-panel-offset-right: calc(
    var(--panel-dock-width, 440px) + var(--spacing-layout-outer, 8px)
  );
}

.layout-view[data-panel-side='left'] {
  --welcome-panel-offset-left: calc(
    var(--panel-dock-width, 440px) + var(--spacing-layout-outer, 8px)
  );
  --welcome-panel-offset-right: 0;
}

.layout-view__background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
</style>
