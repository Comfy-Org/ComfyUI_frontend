<script setup lang="ts">
import { useEventListener, useTimeout } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, shallowRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { safeWidgetMapper } from '@/composables/graph/useGraphNodeManager'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueSettingsStore } from '@/stores/queueStore'

const commandStore = useCommandStore()
const executionStore = useExecutionStore()
const workflowStore = useWorkflowStore()
const { isActiveSubscription } = useSubscription()

const showNoteData = ref(false)

defineProps<{
  toastTo: string | HTMLElement
  notesTo: string | HTMLElement
}>()

const jobFinishedQueue = ref(true)
const {
  ready: jobToastTimeout,
  start: resetJobToastTimeout,
  stop: stopJobTimeout
} = useTimeout(5000, { controls: true })
stopJobTimeout()

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

function nodeToNodeData(node: LGraphNode) {
  const mapper = safeWidgetMapper(node, new Map())
  const widgets = node.widgets?.map(mapper) ?? []
  const dropIndicator =
    node.type !== 'LoadImage'
      ? undefined
      : {
          iconClass: 'icon-[lucide--image]',
          label: t('linearMode.dragAndDropImage')
        }
  //of VueNodeData, only widgets is actually used
  return {
    executing: false,
    id: `${node.id}`,
    mode: 0,
    selected: false,
    title: node.title,
    type: node.type,
    widgets,

    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}

const nodeDatas = computed(() => {
  return graphNodes.value
    .filter(
      (node) =>
        node.mode === 0 &&
        node.widgets?.length &&
        !['MarkdownNote', 'Note'].includes(node.type)
    )
    .map(nodeToNodeData)
    .reverse()
})
const noteDatas = computed(() => {
  return graphNodes.value
    .filter(
      (node) => node.mode === 0 && ['MarkdownNote', 'Note'].includes(node.type)
    )
    .map(nodeToNodeData)
})

const batchCountWidget = {
  options: { precision: 0, min: 1, max: 99 },
  value: 1,
  name: t('linearMode.runCount'),
  type: 'number'
}

const { batchCount } = storeToRefs(useQueueSettingsStore())

//TODO: refactor out of this file.
//code length is small, but changes should propagate
async function runButtonClick(e: Event) {
  if (!jobFinishedQueue.value) return
  try {
    jobFinishedQueue.value = false
    resetJobToastTimeout()
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
  } finally {
    //TODO: Error state indicator for failed queue?
    jobFinishedQueue.value = true
  }
}

defineExpose({ runButtonClick })
</script>
<template>
  <div>
    <linear-workflow-info
      class="h-12 border-x border-border-subtle py-2 px-4 gap-2 bg-comfy-menu-bg flex items-center"
    >
      <span
        class="font-bold truncate min-w-30"
        v-text="workflowStore.activeWorkflow?.filename"
      />
      <div class="flex-1" />
      <Button
        v-if="noteDatas.length"
        variant="muted-textonly"
        @click="showNoteData = !showNoteData"
      >
        <i class="icon-[lucide--info]" />
      </Button>
      <Button v-if="false"> {{ t('menuLabels.publish') }} </Button>
    </linear-workflow-info>
    <div
      class="border gap-2 border-[var(--interface-stroke)] bg-comfy-menu-bg px-2"
    >
      <linear-widgets>
        <template v-for="(nodeData, index) of nodeDatas" :key="nodeData.id">
          <div
            v-if="index !== 0"
            class="w-full border-t-1 border-node-component-border"
          />
          <DropZone
            :on-drag-over="nodeData.onDragOver"
            :on-drag-drop="nodeData.onDragDrop"
            :drop-indicator="nodeData.dropIndicator"
            class="text-muted-foreground"
          >
            <NodeWidgets
              :node-data
              class="py-3 gap-y-4 **:[.col-span-2]:grid-cols-1 text-sm **:[.p-floatlabel]:h-35"
            />
          </DropZone>
        </template>
      </linear-widgets>
      <linear-run-button class="p-4 pb-6 border-t border-node-component-border">
        <WidgetInputNumberInput
          v-model="batchCount"
          :widget="batchCountWidget"
          class="*:[.min-w-0]:w-24 grid-cols-[auto_96px]!"
        />
        <SubscribeToRunButton
          v-if="!isActiveSubscription"
          class="w-full mt-4"
        />
        <div v-else class="flex mt-4 gap-2">
          <Button
            variant="primary"
            class="grow-1"
            size="lg"
            @click="runButtonClick"
          >
            <i class="icon-[lucide--play]" />
            {{ t('menu.run') }}
          </Button>
          <Button
            v-if="!executionStore.isIdle"
            variant="destructive"
            size="lg"
            class="w-10 p-2"
            @click="commandStore.execute('Comfy.Interrupt')"
          >
            <i class="icon-[lucide--x]" />
          </Button>
        </div>
      </linear-run-button>
    </div>
  </div>
  <teleport v-if="!jobToastTimeout || !jobFinishedQueue" defer :to="toastTo">
    <div
      class="bg-base-foreground text-base-background rounded-sm flex h-8 p-1 pr-2 gap-2 items-center"
    >
      <i
        v-if="jobFinishedQueue"
        class="icon-[lucide--check] size-5 bg-success-background"
      />
      <ProgressSpinner v-else class="size-4" />
      <span v-text="t('queue.jobAddedToQueue')" />
    </div>
  </teleport>
  <teleport v-if="showNoteData" defer :to="notesTo">
    <div
      class="bg-base-background text-muted-foreground flex flex-col w-90 gap-2 rounded-2xl border-1 border-border-subtle py-3"
    >
      <Button
        variant="muted-textonly"
        size="icon"
        class="self-end mr-3"
        @click="showNoteData = false"
      >
        <i class="icon-[lucide--x]" />
      </Button>
      <template v-for="nodeData in noteDatas" :key="nodeData.id">
        <div class="w-full border-t border-border-subtle" />
        <NodeWidgets
          :node-data
          class="py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 not-has-[textarea]:flex-0"
        />
      </template>
    </div>
  </teleport>
</template>
