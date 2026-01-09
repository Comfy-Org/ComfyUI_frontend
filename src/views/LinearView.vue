<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  isValidWidgetValue,
  safeWidgetMapper
} from '@/composables/graph/useGraphNodeManager'
import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useQueueSettingsStore } from '@/queue/stores/queueStore'
import { isElectron } from '@/utils/envUtil'

const nodeOutputStore = useNodeOutputStore()
const commandStore = useCommandStore()
const nodeDatas = computed(() => {
  function nodeToNodeData(node: LGraphNode) {
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
      id: `${node.id}`,
      title: node.title,
      type: node.type,
      mode: 0,
      selected: false,
      executing: false,
      widgets
    }
  }
  return app.rootGraph.nodes
    .filter((node) => node.mode === 0 && node.widgets?.length)
    .map(nodeToNodeData)
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
function openFeedback() {
  //TODO: Does not link to a linear specific feedback section
  window.open(
    'https://support.comfy.org/hc/en-us/requests/new?ticket_form_id=40026345549204',
    '_blank',
    'noopener,noreferrer'
  )
}
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
    >
      <SplitterPanel :size="1" class="min-w-min bg-comfy-menu-bg">
        <div
          class="sidebar-content-container h-full w-full overflow-x-hidden overflow-y-auto border-r-1 border-node-component-border"
        >
          <ExtensionSlot :extension="useAssetsSidebarTab()" />
        </div>
      </SplitterPanel>
      <SplitterPanel
        :size="98"
        class="flex flex-row overflow-y-auto flex-wrap min-w-min gap-4 m-4"
      >
        <img
          v-for="previewUrl in nodeOutputStore.latestOutput"
          :key="previewUrl"
          class="pointer-events-none object-contain flex-1 max-h-full"
          :src="previewUrl"
        />
        <img
          v-if="nodeOutputStore.latestOutput.length === 0"
          class="pointer-events-none object-contain flex-1 max-h-full brightness-50 opacity-10"
          src="/assets/images/comfy-logo-mono.svg"
        />
      </SplitterPanel>
      <SplitterPanel :size="1" class="flex flex-col gap-1 p-1 min-w-min">
        <div
          class="actionbar-container flex h-12 items-center rounded-lg border border-[var(--interface-stroke)] p-2 gap-2 bg-comfy-menu-bg justify-end"
        >
          <Button variant="secondary" @click="openFeedback">
            {{ t('g.feedback') }}
          </Button>
          <Button
            variant="secondary"
            class="min-w-max"
            @click="useCanvasStore().linearMode = false"
          >
            {{ t('linearMode.openWorkflow') }}
            <i class="icon-[comfy--workflow]" />
          </Button>
          <Button
            variant="inverted"
            @click="useWorkflowService().exportWorkflow('workflow', 'workflow')"
          >
            {{ t('linearMode.share') }}
          </Button>
          <CurrentUserButton v-if="isLoggedIn" />
          <LoginButton v-else-if="isDesktop" />
        </div>
        <div
          class="rounded-lg border p-2 gap-2 h-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col"
        >
          <div
            class="grow-1 flex justify-start flex-col overflow-y-auto contain-size *:max-h-100"
          >
            <NodeWidgets
              v-for="nodeData of nodeDatas"
              :key="nodeData.id"
              :node-data
              class="border-b-1 border-node-component-border pt-1 pb-2 last:border-none"
            />
          </div>
          <div class="p-4 pb-0 border-t border-node-component-border">
            <WidgetInputNumberInput
              v-model="batchCount"
              :widget="batchCountWidget"
              class="*:[.min-w-56]:basis-0"
            />
            <Button class="w-full mt-4" @click="runButtonClick">
              <i class="icon-[lucide--play]" />
              {{ t('menu.run') }}
            </Button>
          </div>
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
