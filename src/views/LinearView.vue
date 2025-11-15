<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  isValidWidgetValue,
  safeWidgetMapper
} from '@/composables/graph/useGraphNodeManager'
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
import { isElectron } from '@/utils/envUtil'

//const queueStore = useQueueStore()
const nodeOutputStore = useNodeOutputStore()
const commandStore = useCommandStore()
const nodeData = computed(() => {
  const node = app.graph.nodes[0]
  const mapper = safeWidgetMapper(node, new Map())
  const widgets =
    node.widgets?.map((widget) => {
      const safeWidget = mapper(widget)
      safeWidget.callback = function (value) {
        if (!isValidWidgetValue(value)) return
        widget.value = value ?? undefined
        return widget.callback?.(widget.value)
      }
      return safeWidget
    }) ?? []
  //Only widgets is actually used
  return {
    id: '',
    title: '',
    type: '',
    mode: 0,
    selected: false,
    executing: false,
    widgets
  }
})
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()

const batchCountWidget = {
  options: { step2: 1, precision: 1, min: 1, max: 100 },
  value: 1,
  name: t('Number of generations'),
  type: 'number'
}

const { batchCount } = storeToRefs(useQueueSettingsStore())

//TODO: refactor out of this file.
//code length is small, but changes should propagate
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
  <Splitter
    class="absolute h-full w-full"
    :pt="{ gutter: { class: 'bg-transparent' } }"
  >
    <SplitterPanel :size="1" class="min-w-min bg-comfy-menu-bg">
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
    <SplitterPanel :size="1" class="flex flex-col gap-1 p-1 min-w-min">
      <div
        class="actionbar-container flex h-12 items-center rounded-lg border border-[var(--interface-stroke)] p-2 gap-2 bg-comfy-menu-bg justify-end"
      >
        <Button label="Feedback" severity="secondary" />
        <Button
          label="Open Workflow"
          severity="secondary"
          class="min-w-max"
          icon="icon-[comfy--workflow]"
          icon-pos="right"
        />
        <Button label="Share" severity="contrast" />
        <CurrentUserButton v-if="isLoggedIn" />
        <LoginButton v-else-if="isDesktop" />
      </div>
      <div
        class="rounded-lg border border-[var(--interface-stroke)] p-2 gap-2 bg-comfy-menu-bg h-full flex flex-col"
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
      </div>
    </SplitterPanel>
  </Splitter>
</template>
