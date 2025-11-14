<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { useQueueSidebarTab } from '@/composables/sidebarTabs/useQueueSidebarTab'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
//import { useQueueStore } from '@/stores/queueStore'
import { useQueueSettingsStore } from '@/stores/queueStore'

//const queueStore = useQueueStore()
const { vueNodeData } = useGraphNodeManager(app.graph)
const nodeOutputStore = useNodeOutputStore()
const commandStore = useCommandStore()
const nodeData = computed(() => vueNodeData?.values().next().value)

const batchCountWidget = {
  options: { step2: 1, precision: 1, min: 1, max: 100 },
  value: 1,
  name: t('Number of generations'),
  type: 'number'
}

const { batchCount } = storeToRefs(useQueueSettingsStore())

//TODO: refactor out of this file.
//code length is small, but changes should propogate
async function runButtonClick(e: Event) {
  const isShiftPressed = 'shiftKey' in e && e.shiftKey
  const commandId = isShiftPressed
    ? 'Comfy.QueuePromptFront'
    : 'Comfy.QueuePrompt'

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'queue_run_linear'
  })
  if (batchCount.value > 1) {
    useTelemetry()?.trackUiButtonClicked({
      button_id: 'queue_run_multiple_batches_submitted'
    })
  }
  await commandStore.execute(commandId, {
    metadata: {
      subscribe_to_run: false,
      trigger_source: 'button'
    }
  })
}
</script>
<template>
  <Splitter class="absolute h-full w-full">
    <SplitterPanel :size="1" class="min-w-min">
      <div
        class="sidebar-content-container h-full w-full overflow-x-hidden overflow-y-auto"
      >
        <ExtensionSlot :extension="useQueueSidebarTab()" />
      </div>
    </SplitterPanel>
    <SplitterPanel
      :size="98"
      class="flex flex-row overflow-y-auto flex-wrap min-w-min gap-4"
    >
      <img
        v-for="previewUrl in nodeOutputStore.latestOutput"
        :key="previewUrl"
        class="pointer-events-none object-contain flex-1 max-h-full"
        :src="previewUrl"
      />
    </SplitterPanel>
    <SplitterPanel
      :size="1"
      class="flex flex-col gap-4 p-4 bg-component-node-background min-w-min"
    >
      <NodeWidgets :node-data class="overflow-y-auto *:max-h-60" />
      <div class="border-t-1 border-node-component-border pt-4 mx-4">
        <WidgetInputNumberInput
          v-model="batchCount"
          :widget="batchCountWidget"
        />
        <Button
          :label="t('menu.run')"
          class="w-full mt-4"
          icon="icon-[lucide--play]"
          @click="runButtonClick"
        />
      </div>
    </SplitterPanel>
  </Splitter>
</template>
<style scoped>
textarea {
  max-height: 200px;
}
</style>
