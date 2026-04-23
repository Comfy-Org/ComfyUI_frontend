<script setup lang="ts">
/**
 * BuilderPanel — floating right-dock panel for the App Builder flow.
 *
 * Renders the same PanelBlockList App Mode shows, via the same shared
 * state in appModeStore, so the builder is WYSIWYG by construction:
 * what you see while picking / arranging inputs is exactly what App
 * Mode renders at runtime. InputCell's `builder` variant adds the ⋯
 * Rename/Remove menu and inerts the widget body so preview inputs
 * aren't typed into while arranging.
 *
 * Panel preset, collapse state, and `panelRows` all live on
 * appModeStore; moving or rearranging in either view updates both.
 * Graph-canvas click-to-select overlays (widget highlights + output
 * rings) live in AppBuilder.vue — this component owns the panel
 * surface only.
 *
 * Run + Number-of-runs live in BuilderChrome (upper-right cluster) to
 * match App Mode's runtime chrome, not in this panel.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FloatingPanel from '@/components/appMode/layout/panels/FloatingPanel.vue'
import PanelBlockList from '@/components/appMode/layout/panels/PanelBlockList.vue'
import { useAppPanelLayout } from '@/components/appMode/layout/panels/useAppPanelLayout'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { getPathDetails } from '@/utils/formatUtil'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const workflowStore = useWorkflowStore()
const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)
const { isSelectInputsMode, isSelectOutputsMode } = useAppMode()
const { inputEntryMap, moveBlock } = useAppPanelLayout()

// Match App Mode's panel title (the workflow filename) so builder + App
// Mode read as the same surface across modes.
const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return t('linearMode.builder.title')
  return getPathDetails(path).filename
})

const hasInputs = computed(() => appModeStore.selectedInputs.length > 0)

/** Step-specific empty-state copy surfaced when no inputs are picked yet. */
const emptyCopy = computed(() => {
  if (isSelectInputsMode.value) return t('linearMode.builder.inputPlaceholder')
  if (isSelectOutputsMode.value)
    return t('linearMode.builder.outputPlaceholder')
  return t('linearMode.builder.promptAddInputs')
})
</script>

<template>
  <div class="builder-panel-root">
    <FloatingPanel
      v-model:preset="panelPreset"
      v-model:collapsed="panelCollapsed"
      :title="panelTitle"
      movable
    >
      <PanelBlockList
        v-if="hasInputs"
        :rows="panelRows"
        :input-entry-map="inputEntryMap"
        variant="builder"
        @reorder="moveBlock"
      />

      <!-- Empty-state picker target. Dashed affordance matches the original
           builder signal that this is a "drop zone" for widget picks from
           the canvas; radius + colors align with design tokens. -->
      <div
        v-else
        class="m-2 flex flex-1 items-center justify-center rounded-layout-cell border-2 border-dashed border-primary-background/60 bg-primary-background/10 p-6 text-center text-sm text-primary-background"
      >
        {{ emptyCopy }}
      </div>
    </FloatingPanel>
  </div>
</template>

<style scoped>
/* Full-viewport positioned ancestor so FloatingPanel's preset-based
   absolute positioning resolves inside the builder just like it does
   inside .layout-view. Top offset clears the workflow tabs. */
.builder-panel-root {
  position: fixed;
  top: var(--workflow-tabs-height);
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
}

/* Re-enable pointer events on the panel + its drag preview; the outer
   root is non-interactive so graph-canvas clicks pass through empty
   areas. */
.builder-panel-root :deep(.floating-panel),
.builder-panel-root :deep(.panel-drag-preview) {
  pointer-events: auto;
}
</style>
