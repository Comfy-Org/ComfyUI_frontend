<script setup lang="ts">
import { useEventListener, useTimeout } from '@vueuse/core'
import { partition, remove, takeWhile } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
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

defineEmits<{ navigateOutputs: [] }>()

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
    if (node?.mode !== LGraphEventMode.ALWAYS) continue

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
  remove(nodeData.widgets ?? [], (w) => w.slotMetadata?.linked ?? false)
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
    class="flex h-full min-w-80 flex-col"
    v-bind="$attrs"
  >
    <section
      v-if="!mobile"
      data-testid="linear-workflow-info"
      class="flex h-12 items-center gap-2 border-x border-border-subtle bg-comfy-menu-bg px-4 py-2 contain-size"
    >
      <span
        class="truncate font-bold"
        v-text="workflowStore.activeWorkflow?.filename"
      />
      <div class="flex-1" />
      <Popover
        v-if="partitionedNodes[0].length"
        align="end"
        class="z-100 max-h-(--reka-popover-content-available-height) overflow-x-clip overflow-y-auto"
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
              class="max-w-100 gap-y-3 rounded-lg py-3 *:has-[textarea]:h-50 **:[.col-span-2]:grid-cols-1"
            />
          </template>
        </div>
      </Popover>
      <Button v-if="false"> {{ t('menuLabels.publish') }} </Button>
    </section>
    <div
      class="flex h-full flex-col gap-2 border-x border-(--interface-stroke) bg-comfy-menu-bg px-2 md:border-y"
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
                  'gap-y-3 rounded-lg py-3 *:has-[textarea]:h-50 **:[.col-span-2]:grid-cols-1 **:[.h-7]:h-10',
                  nodeData.hasErrors &&
                    'ring-2 ring-node-stroke-error ring-inset'
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
          class="flex h-10 items-center gap-2 rounded-lg bg-base-foreground p-1 pr-2 text-base-background md:h-8 md:bg-secondary-background md:text-base-foreground"
        >
          <template v-if="pendingJobQueues === 0">
            <i
              class="icon-[lucide--check] size-5 not-md:bg-success-background"
            />
            <span class="mr-auto" v-text="t('queue.jobAddedToQueue')" />
            <Button
              v-if="mobile"
              variant="inverted"
              @click="$emit('navigateOutputs')"
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
        class="border-t border-node-component-border p-4 pb-6"
      >
        <SubscribeToRunButton
          v-if="!isActiveSubscription"
          class="mt-4 w-full"
        />
        <div v-else class="mt-4 flex">
          <Popover side="top" @open-auto-focus.prevent>
            <template #button>
              <Button size="lg" class="-mr-3 pr-7">
                <i v-if="batchCount == 1" class="icon-[lucide--chevron-down]" />
                <div v-else class="tabular-nums" v-text="`${batchCount}x`" />
              </Button>
            </template>
            <div
              class="m-1 mb-2 text-node-component-slot-text"
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
        class="border-t border-node-component-border p-4 pb-6"
      >
        <div
          class="m-1 mb-2 text-node-component-slot-text"
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
          class="mt-4 w-full"
        />
        <Button
          v-else
          variant="primary"
          class="mt-4 w-full text-sm"
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
