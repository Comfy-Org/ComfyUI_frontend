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
  <!-- Full-viewport positioned ancestor so FloatingPanel's preset-based
       absolute positioning resolves inside the builder just like it does
       inside .layout-view. The root is pointer-events-none so clicks on
       empty chrome areas fall through to the graph canvas; FloatingPanel
       opts back into pointer-events-auto in its own root class list so
       the panel itself still captures input. Top offset clears the
       workflow tabs. -->
  <div
    class="pointer-events-none fixed inset-x-0 top-(--workflow-tabs-height) bottom-0 z-100"
  >
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
        :class="[
          'm-2 flex flex-1 items-center justify-center p-6',
          'rounded-layout-cell',
          'border-[3px] border-dashed border-(--color-app-mode-active-temp)',
          'bg-(--color-app-mode-active-temp-wash)',
          'text-center text-lg text-(--color-app-mode-active-temp)'
        ]"
      >
        {{ emptyCopy }}
      </div>
    </FloatingPanel>
  </div>
</template>
