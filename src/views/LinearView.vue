<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { ref, useTemplateRef } from 'vue'

import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import LinearWorkflow from '@/renderer/extensions/linearMode/LinearWorkflow.vue'
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type { ResultItemImpl } from '@/stores/queueStore'

const nodeOutputStore = useNodeOutputStore()
const settingStore = useSettingStore()

const hasPreview = ref(false)
whenever(
  () => nodeOutputStore.latestPreview[0],
  () => (hasPreview.value = true)
)

const selectedItem = ref<AssetItem | undefined>()
const selectedOutput = ref<ResultItemImpl | undefined>()
const selectedIndex = ref<[number, number]>([0, 0])
const outputHistoryRef = useTemplateRef('outputHistoryRef')

const linearWorkflowRef = useTemplateRef('linearWorkflowRef')
</script>
<template>
  <div class="absolute w-full h-full">
    <div class="workflow-tabs-container pointer-events-auto h-9.5 w-full">
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
      </div>
    </div>
    <Splitter
      class="h-[calc(100%-38px)] w-full bg-comfy-menu-secondary-bg"
      :pt="{ gutter: { class: 'bg-transparent w-4 -mx-3' } }"
      @resizestart="({ originalEvent }) => originalEvent.preventDefault()"
    >
      <SplitterPanel
        id="linearLeftPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <OutputHistory
          v-if="settingStore.get('Comfy.Sidebar.Location') === 'left'"
          ref="outputHistoryRef"
          scroll-reset-button-to="#linearDockBottomLeft"
          @update-selection="
            (e) => {
              ;[selectedItem, selectedOutput, selectedIndex] = e
              hasPreview = false
            }
          "
        />
        <LinearWorkflow
          v-else
          ref="linearWorkflowRef"
          toast-to="#linearDockBottomLeft"
          notes-to="#linearDockTopLeft"
        />
        <div />
      </SplitterPanel>
      <SplitterPanel
        id="linearCenterPanel"
        :size="98"
        class="flex flex-col min-w-min gap-4 mx-2 px-10 pt-8 pb-4 relative text-muted-foreground outline-none"
        @wheel.capture="(e: WheelEvent) => outputHistoryRef?.onWheel(e)"
      >
        <LinearPreview
          :latent-preview="
            selectedIndex[0] === 0 && selectedIndex[1] === 0 && hasPreview
              ? nodeOutputStore.latestPreview[0]
              : undefined
          "
          :run-button-click="linearWorkflowRef?.runButtonClick"
          :selected-item
          :selected-output
        />
        <div id="linearDockTopLeft" class="absolute z-20 top-4 left-4" />
        <div id="linearDockTopRight" class="absolute z-20 top-4 right-4" />
        <div id="linearDockBottomLeft" class="absolute z-20 bottom-4 left-4" />
        <div
          id="linearDockBottomRight"
          class="absolute z-20 bottom-4 right-4"
        />
      </SplitterPanel>
      <SplitterPanel
        id="linearRightPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <LinearWorkflow
          v-if="settingStore.get('Comfy.Sidebar.Location') === 'left'"
          ref="linearWorkflowRef"
          toast-to="#linearDockBottomRight"
          notes-to="#linearDockTopRight"
        />
        <OutputHistory
          v-else
          ref="outputHistoryRef"
          scroll-reset-button-to="#linearDockBottomRight"
          @update-selection="
            (e) => {
              ;[selectedItem, selectedOutput, selectedIndex] = e
              hasPreview = false
            }
          "
        />
        <div />
      </SplitterPanel>
    </Splitter>
  </div>
</template>
