<script setup lang="ts">
import { useEventListener, useTimeout } from '@vueuse/core'
import { partition, remove, takeWhile } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/common/Loader.vue'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { resolveNode } from '@/utils/litegraphUtil'
const { t } = useI18n()
const commandStore = useCommandStore()
const executionErrorStore = useExecutionErrorStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
const settingStore = useSettingStore()
const { isActiveSubscription } = useBillingContext()
const workflowStore = useWorkflowStore()
const { isBuilderMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)

const props = defineProps<{
  toastTo?: string | HTMLElement
  mobile?: boolean
}>()

defineEmits<{ navigateAssets: [] }>()

//NOTE: due to batching, will never be greater than 2
const pendingJobQueues = ref(0)
const { ready: jobToastTimeout, start: resetJobToastTimeout } = useTimeout(
  8000,
  { controls: true, immediate: false }
)

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

const mappedSelections = computed(() => {
  let unprocessedInputs = [...appModeStore.selectedInputs]
  //FIXME strict typing here
  const processedInputs: ReturnType<typeof nodeToNodeData>[] = []
  while (unprocessedInputs.length) {
    const nodeId = unprocessedInputs[0][0]
    const inputGroup = takeWhile(
      unprocessedInputs,
      ([id]) => id === nodeId
    ).map(([, widgetName]) => widgetName)
    unprocessedInputs = unprocessedInputs.slice(inputGroup.length)
    const node = resolveNode(nodeId)
    if (!node) continue

    const nodeData = nodeToNodeData(node)
    remove(nodeData.widgets ?? [], (w) => !inputGroup.includes(w.name))
    processedInputs.push(nodeData)
  }
  return processedInputs
})

function getDropIndicator(node: LGraphNode) {
  if (node.type !== 'LoadImage') return undefined

  const filename = node.widgets?.[0]?.value
  const resultItem = { type: 'input', filename: `${filename}` }

  const buildImageUrl = () => {
    if (!filename) return undefined
    const params = new URLSearchParams(resultItem)
    appendCloudResParam(params, resultItem.filename)
    return api.apiURL(`/view?${params}${app.getPreviewFormatParam()}`)
  }

  return {
    iconClass: 'icon-[lucide--image]',
    imageUrl: buildImageUrl(),
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
    hasErrors: !!executionErrorStore.lastNodeErrors?.[node.id],

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

//TODO: refactor out of this file.
//code length is small, but changes should propagate
async function runButtonClick(e: Event) {
  try {
    pendingJobQueues.value += 1
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
    pendingJobQueues.value -= 1
  }
}

defineExpose({ runButtonClick })
</script>
<template>
  <div
    v-if="!isBuilderMode && hasOutputs"
    class="flex flex-col min-w-80 h-full"
    v-bind="$attrs"
  >
    <section
      v-if="!mobile"
      data-testid="linear-workflow-info"
      class="h-12 border-x border-border-subtle py-2 px-4 gap-2 bg-comfy-menu-bg flex items-center contain-size"
    >
      <span
        class="font-bold truncate"
        v-text="workflowStore.activeWorkflow?.filename"
      />
      <div class="flex-1" />
      <Popover
        v-if="partitionedNodes[0].length"
        align="end"
        class="overflow-y-auto overflow-x-clip max-h-(--reka-popover-content-available-height) z-100"
        side="bottom"
        :side-offset="-8"
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
              class="py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 *:has-[textarea]:h-50 rounded-lg max-w-100"
            />
          </template>
        </div>
      </Popover>
      <Button v-if="false"> {{ t('menuLabels.publish') }} </Button>
    </section>
    <div
      class="border-x md:border-y gap-2 h-full border-(--interface-stroke) bg-comfy-menu-bg flex flex-col px-2"
    >
      <section
        data-testid="linear-widgets"
        class="grow overflow-y-auto contain-size"
      >
        <template
          v-for="(nodeData, index) of appModeStore.selectedInputs.length
            ? mappedSelections
            : partitionedNodes[0]"
          :key="nodeData.id"
        >
          <div
            v-if="index !== 0 && !appModeStore.selectedInputs.length"
            class="w-full border-t border-node-component-border"
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
                  'py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 *:has-[textarea]:h-50 rounded-lg **:[.h-7]:h-10',
                  nodeData.hasErrors &&
                    'ring-2 ring-inset ring-node-stroke-error'
                )
              "
            />
          </DropZone>
        </template>
      </section>
      <Teleport
        v-if="!jobToastTimeout || pendingJobQueues > 0"
        defer
        :disabled="mobile"
        :to="toastTo"
      >
        <div
          class="bg-base-foreground md:bg-secondary-background text-base-background md:text-base-foreground rounded-lg flex h-10 md:h-8 p-1 pr-2 gap-2 items-center"
        >
          <template v-if="pendingJobQueues === 0">
            <i
              class="icon-[lucide--check] size-5 not-md:bg-success-background"
            />
            <span class="mr-auto" v-text="t('queue.jobAddedToQueue')" />
            <Button
              v-if="mobile"
              variant="inverted"
              @click="$emit('navigateAssets')"
            >
              {{ t('linearMode.viewJob') }}
            </Button>
          </template>
          <template v-else>
            <Loader size="sm" />
            <span v-text="t('queue.jobQueueing')" />
          </template>
        </div>
      </Teleport>
      <section
        v-if="mobile"
        data-testid="linear-run-button"
        class="p-4 pb-6 border-t border-node-component-border"
      >
        <SubscribeToRunButton
          v-if="!isActiveSubscription"
          class="w-full mt-4"
        />
        <div v-else class="flex mt-4">
          <Popover side="top" @open-auto-focus.prevent>
            <template #button>
              <Button size="lg" class="-mr-3 pr-7">
                <i v-if="batchCount == 1" class="icon-[lucide--chevron-down]" />
                <div v-else class="tabular-nums" v-text="`${batchCount}x`" />
              </Button>
            </template>
            <div
              class="mb-2 m-1 text-node-component-slot-text"
              v-text="t('linearMode.runCount')"
            />
            <ScrubableNumberInput
              v-model="batchCount"
              :aria-label="t('linearMode.runCount')"
              :min="1"
              :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
              class="h-10 min-w-40"
            />
          </Popover>
          <Button
            variant="primary"
            class="grow"
            size="lg"
            @click="runButtonClick"
          >
            <i class="icon-[lucide--play]" />
            {{ t('menu.run') }}
          </Button>
        </div>
      </section>
      <section
        v-else
        data-testid="linear-run-button"
        class="p-4 pb-6 border-t border-node-component-border"
      >
        <div
          class="mb-2 m-1 text-node-component-slot-text"
          v-text="t('linearMode.runCount')"
        />
        <ScrubableNumberInput
          v-model="batchCount"
          :aria-label="t('linearMode.runCount')"
          :min="1"
          :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
          class="h-7 min-w-40"
        />
        <SubscribeToRunButton
          v-if="!isActiveSubscription"
          class="w-full mt-4"
        />
        <Button
          v-else
          variant="primary"
          class="w-full mt-4 text-sm"
          size="lg"
          @click="runButtonClick"
        >
          <i class="icon-[lucide--play]" />
          {{ t('menu.run') }}
        </Button>
      </section>
    </div>
  </div>
</template>
