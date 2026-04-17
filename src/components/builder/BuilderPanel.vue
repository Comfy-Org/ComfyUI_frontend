<script setup lang="ts">
/**
 * BuilderPanel — floating right-dock panel for the App Builder flow.
 *
 * Renders the same widget list App Mode shows so the builder reads as
 * WYSIWYG: what you see while picking/arranging inputs is what the end
 * user will see. AppModeWidgetList with `builder-mode` provides the
 * delete/rename popover and drag handles; DraggableList wraps it during
 * the arrange step so blocks can be reordered. Panel preset + drag
 * behavior come from FloatingPanel (shared with App Mode) and are
 * bound to `appModeStore.panelPreset` so moving the panel in either
 * view updates both.
 *
 * Graph-canvas click-to-select overlays (widget highlights + output
 * rings) live in AppBuilder.vue — this component owns the panel surface
 * only.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FloatingPanel from '@/components/appMode/layout/panels/FloatingPanel.vue'
import BatchCountCell from '@/components/appMode/layout/cells/BatchCountCell.vue'
import RunCell from '@/components/appMode/layout/cells/RunCell.vue'
import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import DraggableList from '@/components/common/DraggableList.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { getPathDetails } from '@/utils/formatUtil'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const workflowStore = useWorkflowStore()
const { panelPreset, panelCollapsed } = storeToRefs(appModeStore)
const { isSelectInputsMode, isSelectOutputsMode, isArrangeMode } = useAppMode()

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
      <DraggableList
        v-if="isArrangeMode && hasInputs"
        v-model="appModeStore.selectedInputs"
        class="overflow-x-clip"
      >
        <AppModeWidgetList builder-mode />
      </DraggableList>
      <AppModeWidgetList v-else-if="hasInputs" builder-mode />

      <!-- Empty-state picker target. Dashed affordance matches the original
           builder signal that this is a "drop zone" for widget picks from
           the canvas; radius + colors align with design tokens. -->
      <div
        v-else
        class="m-2 flex flex-1 items-center justify-center rounded-(--layout-cell-radius) border-2 border-dashed border-primary-background/60 bg-primary-background/10 p-6 text-center text-sm text-primary-background"
      >
        {{ emptyCopy }}
      </div>

      <!-- Footer preview: Run + Number-of-runs rendered exactly as they
           appear in App Mode so the builder is WYSIWYG. Disabled here
           because the workflow isn't executable from the builder — the
           `builder-panel-footer-disabled` wrapper greys them out and
           blocks pointer events. Tooltip explains the state on hover. -->
      <template #footer>
        <div
          class="builder-panel-footer-disabled"
          :title="t('linearMode.builder.runDisabledHint')"
          aria-disabled="true"
        >
          <div class="builder-panel-footer-row">
            <BatchCountCell />
          </div>
          <div class="builder-panel-footer-row builder-panel-footer-run">
            <RunCell />
          </div>
        </div>
      </template>
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

/* Disabled footer preview — Run + BatchCount look exactly like App Mode
   so the builder is WYSIWYG, but they're inert and dimmed to signal
   "available after you open this in App Mode." */
.builder-panel-footer-disabled {
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: 0.55;
  pointer-events: none;
  user-select: none;
  cursor: not-allowed;
}

.builder-panel-footer-row {
  height: var(--layout-cell-size);
  background-color: var(--layout-color-cell-fill);
  border-radius: var(--layout-cell-radius);
}

.builder-panel-footer-run {
  /* Run cell carries the accent fill itself; clear the outer surface
     so the green reads through without a second background layer. */
  background-color: transparent;
}
</style>
