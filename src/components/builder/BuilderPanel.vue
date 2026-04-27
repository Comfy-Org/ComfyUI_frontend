<script setup lang="ts">
/**
 * Floating right-dock panel for the App Builder flow. Renders the
 * same PanelBlockList as App Mode, reading from the same appModeStore
 * — the builder is WYSIWYG with App Mode by construction. InputCell's
 * `builder` variant adds rename/remove and inerts the widget body so
 * inputs aren't typed into during arrangement.
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

// Match App Mode's panel title (workflow filename) for WYSIWYG parity.
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
  <!-- Positioned ancestor so FloatingPanel's absolute positioning
       resolves correctly. Left offset by `--sidebar-width` so the
       coordinate system starts past the Comfy sidebar — matching
       App Mode, where LayoutView is a flex sibling of the sidebar
       and already starts past it. Root is pointer-events-none so
       empty chrome space falls through to the graph canvas. -->
  <div
    class="pointer-events-none fixed top-(--workflow-tabs-height) right-0 bottom-0 left-(--sidebar-width,0px) z-100"
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

      <!-- Empty-state drop-zone affordance for widget picks from the canvas. -->
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
