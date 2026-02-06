<script setup lang="ts">
import { useEventListener, useTimeout } from '@vueuse/core'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const commandStore = useCommandStore()
const executionStore = useExecutionStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
const { isActiveSubscription } = useSubscription()
const workflowStore = useWorkflowStore()

const props = defineProps<{
  toastTo?: string | HTMLElement
  notesTo?: string | HTMLElement
  mobile?: boolean
}>()

const jobFinishedQueue = ref(true)
const { ready: jobToastTimeout, start: resetJobToastTimeout } = useTimeout(
  5000,
  { controls: true, immediate: false }
)

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

function getDropIndicator(node: LGraphNode) {
  if (node.type !== 'LoadImage') return undefined

  const filename = node.widgets?.[0]?.value
  const resultItem = { type: 'input', filename: `${filename}` }

  return {
    iconClass: 'icon-[lucide--image]',
    imageUrl: filename
      ? api.apiURL(
          `/view?${new URLSearchParams(resultItem)}${app.getPreviewFormatParam()}`
        )
      : undefined,
    label: t('linearMode.dragAndDropImage'),
    onClick: () => node.widgets?.[1]?.callback?.(undefined)
  }
}

function nodeToNodeData(node: LGraphNode) {
  const dropIndicator = getDropIndicator(node)
  const nodeData = extractVueNodeData(node)
  for (const widget of nodeData.widgets ?? []) widget.slotMetadata = undefined

  return {
    ...nodeData,
    //note lastNodeErrors uses exeuctionid, node.id is execution for root
    hasErrors: !!executionStore.lastNodeErrors?.[node.id],

    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}
const partitionedNodes = computed(() => {
  const parts = partition(
    graphNodes.value
      .filter((node) => node.mode === 0 && node.widgets?.length)
      .map(nodeToNodeData)
      .reverse(),
    (node) => ['MarkdownNote', 'Note'].includes(node.type)
  )
  for (const noteNode of parts[0]) {
    for (const widget of noteNode.widgets ?? [])
      widget.options = { ...widget.options, read_only: true }
  }
  return parts
})

const batchCountWidget: SimplifiedWidget<number> = {
  options: { precision: 0, min: 1, max: isCloud ? 4 : 99 },
  value: 1,
  name: t('linearMode.runCount'),
  type: 'number'
} as const

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

    if (batchCount.value > 1) {
      useTelemetry()?.trackUiButtonClicked({
        button_id: 'queue_run_multiple_batches_submitted'
      })
    }
    await commandStore.execute(commandId, {
      metadata: {
        subscribe_to_run: false,
        trigger_source: 'linear'
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
  <div class="flex flex-col min-w-80 md:h-full">
    <section
      v-if="mobile"
      data-testid="linear-run-button"
      class="p-4 pb-6 border-t border-node-component-border"
    >
      <WidgetInputNumberInput
        v-model="batchCount"
        :widget="batchCountWidget"
        class="*:[.min-w-0]:w-24 grid-cols-[auto_96px]!"
      />
      <SubscribeToRunButton v-if="!isActiveSubscription" class="w-full mt-4" />
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
    </section>
    <section
      data-testid="linear-workflow-info"
      class="h-12 border-x border-border-subtle py-2 px-4 gap-2 bg-comfy-menu-bg flex items-center md:contain-size"
    >
      <span
        class="font-bold truncate"
        v-text="workflowStore.activeWorkflow?.filename"
      />
      <div class="flex-1" />
      <Popover
        v-if="partitionedNodes[0].length"
        align="start"
        class="overflow-y-auto overflow-x-clip max-h-(--reka-popover-content-available-height) z-100"
        :reference="notesTo"
        side="left"
        :to="notesTo"
      >
        <template #button>
          <Button variant="muted-textonly">
            <i class="icon-[lucide--info]" />
          </Button>
        </template>
        <div>
          <template
            v-for="(nodeData, index) in partitionedNodes[0]"
            :key="nodeData.id"
          >
            <div
              v-if="index !== 0"
              class="w-full border-t border-border-subtle"
            />
            <NodeWidgets
              :node-data
              :style="{ background: applyLightThemeColor(nodeData.bgcolor) }"
              class="py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 *:has-[textarea]:h-50 rounded-lg max-w-100"
            />
          </template>
        </div>
      </Popover>
      <Button v-if="false"> {{ t('menuLabels.publish') }} </Button>
    </section>
    <div
      class="border gap-2 md:h-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col px-2"
    >
      <section
        data-testid="linear-widgets"
        class="grow-1 md:overflow-y-auto md:contain-size"
      >
        <template
          v-for="(nodeData, index) of partitionedNodes[1]"
          :key="nodeData.id"
        >
          <div
            v-if="index !== 0"
            class="w-full border-t-1 border-node-component-border"
          />
          <DropZone
            :on-drag-over="nodeData.onDragOver"
            :on-drag-drop="nodeData.onDragDrop"
            :drop-indicator="mobile ? undefined : nodeData.dropIndicator"
            class="text-muted-foreground"
          >
            <NodeWidgets
              :node-data
              :class="
                cn(
                  'py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 *:has-[textarea]:h-50 rounded-lg',
                  nodeData.hasErrors &&
                    'ring-2 ring-inset ring-node-stroke-error'
                )
              "
              :style="{ background: applyLightThemeColor(nodeData.bgcolor) }"
            />
          </DropZone>
        </template>
      </section>
      <section
        v-if="!mobile"
        data-testid="linear-run-button"
        class="p-4 pb-6 border-t border-node-component-border"
      >
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
      </section>
    </div>
  </div>
  <Teleport
    v-if="(!jobToastTimeout || !jobFinishedQueue) && toastTo"
    defer
    :to="toastTo"
  >
    <div
      class="bg-base-foreground text-base-background rounded-sm flex h-8 p-1 pr-2 gap-2 items-center"
    >
      <i
        v-if="jobFinishedQueue"
        class="icon-[lucide--check] size-5 bg-success-background"
      />
      <i v-else class="icon-[lucide--loader-circle] size-4 animate-spin" />
      <span v-text="t('queue.jobAddedToQueue')" />
    </div>
  </Teleport>
  <Teleport v-if="false" defer :to="notesTo">
    <div
      class="bg-base-background text-muted-foreground flex flex-col w-90 gap-2 rounded-2xl border-1 border-border-subtle py-3"
    ></div>
  </Teleport>
</template>
