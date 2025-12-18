<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, ref, watch } from 'vue'

import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  isValidWidgetValue,
  safeWidgetMapper
} from '@/composables/graph/useGraphNodeManager'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { isElectron } from '@/utils/envUtil'
import { cn } from '@/utils/tailwindUtil'

const outputs = useMediaAssets('output')

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
const activeLoad = ref<[number, number]>([-1, -1])

function loadWorkflow(item: AssetItem, index: [number, number]) {
  const { workflow } = item.user_metadata as { workflow?: ComfyWorkflowJSON }
  if (!workflow) return
  activeLoad.value = index
  if (workflow.id !== app.rootGraph.id) return app.loadGraphData(workflow)
  //update graph to new version, set old to top of undo queue
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) return app.loadGraphData(workflow)
  changeTracker.redoQueue = []
  changeTracker.updateState([workflow], changeTracker.undoQueue)
}

function allOutputs(item: AssetItem): [string, number][] {
  if (item.user_metadata?.allOutputs)
    return (item.user_metadata.allOutputs as { url: string }[]).map(
      (output, index) => [output.url, index]
    )
  return []
}

const previewUrl = computed(() => {
  const [index, key] = activeLoad.value
  if (index >= 0 && key >= 0) {
    const output = allOutputs(outputs.media.value[index])[key][0]
    if (output) return output
  }
  return allOutputs(outputs.media.value[0])[0][0]
})

watch(outputs.media.value, () => {
  activeLoad.value = [-1, -1]
})

function gotoNextOutput() {
  const [index, key] = activeLoad.value
  if (index < 0 || key < 0) {
    activeLoad.value = [0, 0]
    return
  }
  const currentItem = outputs.media.value[index]
  if (allOutputs(currentItem)[key + 1]) {
    activeLoad.value = [index, key + 1]
    return
  }
  if (outputs.media.value[index + 1]) {
    activeLoad.value = [index + 1, 0]
  }
  //do nothing, no next output
}

function gotoPreviousOutput() {
  const [index, key] = activeLoad.value
  if (key > 0) {
    activeLoad.value = [index, key - 1]
    return
  }
  if (index > 0) {
    const currentItem = outputs.media.value[index - 1]
    activeLoad.value = [index - 1, allOutputs(currentItem).length - 1]
    return
  }
  activeLoad.value = [-1, -1]
}

function handleCenterWheel(e: WheelEvent) {
  //TODO roll in litegraph/CanvasPointer and give slight stickiness when on trackpad
  if (e.deltaY > 0) gotoNextOutput()
  else {
    gotoPreviousOutput()
  }
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
      <SplitterPanel :size="1" class="min-w-24 bg-comfy-menu-bg">
        <div
          class="sidebar-content-container h-full w-full overflow-y-auto border-r-1 border-node-component-border flex flex-col items-center"
        >
          <div
            v-for="(item, index) in outputs.media.value"
            :key="index"
            :class="
              cn('py-3 border-border-subtle w-18', index !== 0 && 'border-t')
            "
          >
            <img
              v-for="[output, key] in allOutputs(item)"
              :key
              :class="
                cn(
                  'size-16 p-1 rounded-lg',
                  index === activeLoad[0] && key === activeLoad[1] && 'border-2'
                )
              "
              :src="output"
              @click="loadWorkflow(item, [index, key])"
            />
          </div>
        </div>
      </SplitterPanel>
      <SplitterPanel
        :size="98"
        class="flex flex-row overflow-y-auto flex-wrap min-w-min gap-4 m-4"
        @wheel="handleCenterWheel"
      >
        <img
          v-if="previewUrl"
          class="pointer-events-none object-contain flex-1 max-h-full"
          :src="previewUrl"
        />
        <img
          v-else
          class="pointer-events-none object-contain flex-1 max-h-full brightness-50 opacity-10"
          src="/assets/images/comfy-logo-mono.svg"
        />
      </SplitterPanel>
      <SplitterPanel :size="1" class="flex flex-col gap-1 p-1 min-w-min">
        <div
          class="actionbar-container flex h-12 items-center rounded-lg border border-[var(--interface-stroke)] p-2 gap-2 bg-comfy-menu-bg justify-end"
        >
          <Button
            :label="t('g.feedback')"
            severity="secondary"
            @click="openFeedback"
          />
          <Button
            :label="t('linearMode.openWorkflow')"
            severity="secondary"
            class="min-w-max"
            icon="icon-[comfy--workflow]"
            icon-pos="right"
            @click="useCanvasStore().linearMode = false"
          />
          <Button
            :label="t('linearMode.share')"
            severity="contrast"
            @click="useWorkflowService().exportWorkflow('workflow', 'workflow')"
          />
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
  </div>
</template>
