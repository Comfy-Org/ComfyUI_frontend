<script setup lang="ts">
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import ComfyRunButton from '@/components/actionbar/ComfyActionbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useQueueSidebarTab } from '@/composables/sidebarTabs/useQueueSidebarTab'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
//import { useQueueStore } from '@/stores/queueStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

const vueNodeLifecycle = useVueNodeLifecycle()
//const queueStore = useQueueStore()
const nodeOutputStore = useNodeOutputStore()

const nodeData = computed(
  () => vueNodeLifecycle.nodeManager.value?.vueNodeData?.values().next().value
)
//Always display most recently generated output?
//- trace preview store?
//- add listener for b_preview?
//- Copy/pasta prior art in QueueSidebarTab?
//  - Remove this doubled logic for linear mode?

/*
  <div class="flex flex-col gap-4 py-4 bg-component-node-background">
    <!--TODO Fix padding-->
    <NodeWidgets :node-data/>
    <!--TODO make new. Don't want drag/drop-->
    <div class="border-t-1 border-node-component-border pt-4">
      <ComfyRunButton/></div>
  </div>
*/
</script>
<template>
  <Splitter>
    <SplitterPanel :size="10">
      <div
        class="sidebar-content-container h-full w-full overflow-x-hidden overflow-y-auto"
      >
        <ExtensionSlot :extension="useQueueSidebarTab()" />
      </div>
    </SplitterPanel>
    <SplitterPanel :size="60">
      <img
        v-for="previewUrl in nodeOutputStore.latestOutput"
        :key="previewUrl"
        class="m-auto h-full object-contain w-full pointer-events-none"
        :src="previewUrl"
      />
    </SplitterPanel>
    <SplitterPanel
      :size="30"
      class="flex flex-col gap-4 py-4 bg-component-node-background"
    >
      <!--TODO Fix padding-->
      <NodeWidgets :node-data />
      <!--TODO make new. Don't want drag/drop-->
      <div class="border-t-1 border-node-component-border pt-4">
        <ComfyRunButton />
      </div>
    </SplitterPanel>
  </Splitter>
</template>
