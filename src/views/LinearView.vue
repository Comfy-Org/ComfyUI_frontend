<script setup lang="ts">
import Button from 'primevue/button'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { useQueueSidebarTab } from '@/composables/sidebarTabs/useQueueSidebarTab'
import { t } from '@/i18n'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumber from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
//import { useQueueStore } from '@/stores/queueStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

const { vueNodeData } = useGraphNodeManager(app.graph)
//const queueStore = useQueueStore()
const nodeOutputStore = useNodeOutputStore()

const batchCountWidget = {
  options: { step2: 1, precision: 1, min: 1, max: 100 },
  value: 1,
  name: t('Number of generations'),
  type: 'number'
}

const nodeData = computed(() => vueNodeData?.values().next().value)
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
        <WidgetInputNumber :widget="batchCountWidget" />
        <Button />
      </div>
    </SplitterPanel>
  </Splitter>
</template>
