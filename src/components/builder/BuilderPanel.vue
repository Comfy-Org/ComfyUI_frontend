<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FloatingPanel from '@/components/appMode/layout/panels/FloatingPanel.vue'
import PanelBlockList from '@/components/appMode/layout/panels/PanelBlockList.vue'
import { useAppPanelLayout } from '@/components/appMode/layout/panels/useAppPanelLayout'
import { useAppMode } from '@/composables/useAppMode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { getPathDetails } from '@/utils/formatUtil'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)
const { isSelectInputsMode, isSelectOutputsMode } = useAppMode()
const { inputEntryMap, moveBlock } = useAppPanelLayout()

// Reserve sidebar gutter on the side the user has it pinned to so the
// floating-panel bounds don't overlap with a right-side sidebar.
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') !== 'right'
)

const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return t('linearMode.builder.title')
  return getPathDetails(path).filename
})

const hasInputs = computed(() => appModeStore.selectedInputs.length > 0)

const emptyCopy = computed(() => {
  if (isSelectInputsMode.value) return t('linearMode.builder.inputPlaceholder')
  if (isSelectOutputsMode.value)
    return t('linearMode.builder.outputPlaceholder')
  return t('linearMode.builder.promptAddInputs')
})
</script>

<template>
  <!-- Positioned ancestor for FloatingPanel; offset past whichever
       side the sidebar is pinned to. -->
  <div
    :class="
      cn(
        'pointer-events-none fixed top-(--workflow-tabs-height) bottom-0 z-100',
        sidebarOnLeft
          ? 'right-0 left-(--sidebar-width,0px)'
          : 'right-(--sidebar-width,0px) left-0'
      )
    "
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

      <div
        v-else
        class="m-2 flex flex-1 items-center justify-center rounded-layout-cell border-[3px] border-dashed border-warning-background bg-warning-background/10 p-6 text-center text-lg text-warning-background"
      >
        {{ emptyCopy }}
      </div>
    </FloatingPanel>
  </div>
</template>
