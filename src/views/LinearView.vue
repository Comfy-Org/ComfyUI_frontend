<script setup lang="ts">
import { useEventListener, useInfiniteScroll, useScroll } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Divider from 'primevue/divider'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import Button from '@/components/ui/button/Button.vue'
import { safeWidgetMapper } from '@/composables/graph/useGraphNodeManager'
import { d, t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const outputs = useMediaAssets('output')

const commandStore = useCommandStore()

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

const nodeDatas = computed(() => {
  function nodeToNodeData(node: LGraphNode) {
    const mapper = safeWidgetMapper(node, new Map())
    const widgets = node.widgets?.map(mapper) ?? []
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
  return graphNodes.value
    .filter((node) => node.mode === 0 && node.widgets?.length)
    .map(nodeToNodeData)
})

const batchCountWidget = {
  options: { precision: 0, min: 1, max: 99 },
  value: 1,
  name: t('Run count:'),
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
const outputsRef = useTemplateRef('outputsRef')
const { reset: resetInfiniteScroll } = useInfiniteScroll(
  outputsRef,
  outputs.loadMore,
  { canLoadMore: () => outputs.hasMore.value }
)
function resetOutputsScroll() {
  //TODO need to also prune outputs entries?
  resetInfiniteScroll()
  outputsRef.value?.scrollTo(0, 0)
  activeLoad.value = [-1, -1]
}
const { y: outputScrollState } = useScroll(outputsRef)

watch(activeLoad, () => {
  const [index, key] = activeLoad.value
  if (index < 0 || key < 0 || !outputsRef.value) return
  const outputElement = outputsRef.value.children[index].children[key]
  //container: 'nearest' is nice, but bleeding edge and chrome only
  outputElement.scrollIntoView({ block: 'nearest' })
})

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

function allOutputs(item?: AssetItem) {
  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  if (!user_metadata?.allOutputs) return []
  return user_metadata.allOutputs
}

const activeItem = computed(() => {
  const [index] = activeLoad.value
  return outputs.media.value[index]
})

const preview = computed(() => {
  const [index, key] = activeLoad.value
  if (index >= 0 && key >= 0) {
    const output = allOutputs(outputs.media.value[index])[key]
    if (output) return output
  }
  return allOutputs(outputs.media.value[0])[0]
})

//TODO: reconsider reactivity of locale.
const dateOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
} as const
const timeOptions = {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
} as const

function formatTime(time: string) {
  if (!time) return ''
  const date = new Date(time)
  return `${d(date, dateOptions)} | ${d(date, timeOptions)}`
}

//NOTE Sleek, but not widely available
/*
const durationFormatter = new Intl.DurationFormat(locale.value, { style: 'narrow' })
function formatDuration(seconds: number) {
  if (seconds == undefined) return ''
  return durationFormatter.format({ seconds: seconds | 0})
}
*/
function formatDuration(durationSeconds?: number) {
  if (durationSeconds == undefined) return ''
  const hours = (durationSeconds / 60 ** 2) | 0
  const minutes = ((durationSeconds % 60 ** 2) / 60) | 0
  const seconds = (durationSeconds % 60) | 0
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

type StatItem = { content?: string; iconClass?: string }
const mediaTypes: Record<string, StatItem> = {
  images: { content: t('image'), iconClass: 'icon-[lucide--image]' },
  video: { content: t('video'), iconClass: 'icon-[lucide--video]' },
  audio: { content: t('audio'), iconClass: 'icon-[lucide--audio-lines]' }
}
const itemStats = computed<StatItem[]>(() => {
  if (!activeItem.value) return []
  const user_metadata = getOutputAssetMetadata(activeItem.value.user_metadata)
  if (!user_metadata) return []
  const { allOutputs } = user_metadata
  const activeOutput = allOutputs?.[activeLoad.value[1]]
  return [
    { content: formatTime(activeItem.value.created_at) },
    { content: formatDuration(user_metadata.executionTimeInSeconds) },
    allOutputs && { content: `${allOutputs.length} asset` },
    //TODO asset icon
    (activeOutput?.mediaType && mediaTypes[activeOutput?.mediaType]) ?? {}
  ].filter((i) => !!i)
})

watch(outputs.media.value, () => {
  //TODO: Consider replace with resetOutputsScroll?
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
      @resizestart="({ originalEvent }) => originalEvent.preventDefault()"
    >
      <SplitterPanel :size="1" class="min-w-38 bg-comfy-menu-bg flex relative">
        <div
          class="h-full flex flex-col items-end align-center w-14 p-2 border-r border-node-component-border"
        >
          <Button class="bg-transparent">
            <i class="size-4 icon-[comfy--workflow] bg-muted-foreground" />
          </Button>
          <div class="flex-1" />
          <div class="p-1 bg-secondary-background rounded-lg w-10">
            <!--FIXME: pointer-events-none means no tooltips-->
            <Button
              class="rounded-b-none pointer-events-none"
              size="icon"
              :title="t('Simple Mode')"
              variant="inverted"
            >
              <i class="icon-[lucide--panels-top-left]" />
            </Button>
            <Button
              class="rounded-t-none"
              size="icon"
              :title="t('Graph Mode')"
              @click="useCanvasStore().linearMode = false"
            >
              <i class="icon-[comfy--workflow]" />
            </Button>
          </div>
        </div>
        <div
          ref="outputsRef"
          class="h-full min-w-24 grow-1 p-3 overflow-y-auto border-r-1 border-node-component-border flex flex-col items-center"
        >
          <div
            v-for="(item, index) in outputs.media.value"
            :key="index"
            :class="
              cn(
                'py-3 border-border-subtle flex flex-col w-full px-1',
                index !== 0 && 'border-t-2'
              )
            "
          >
            <img
              v-for="(output, key) in allOutputs(item)"
              :key
              :class="
                cn(
                  'p-1 rounded-lg aspect-square object-cover',
                  index === activeLoad[0] && key === activeLoad[1] && 'border-2'
                )
              "
              :src="output.url"
              @click="loadWorkflow(item, [index, key])"
            />
          </div>
        </div>
        <!--FIXME: Z-index of this button is wrong, and stacking contexts are funky. Need -right-22 once fixed-->
        <Button
          v-if="outputScrollState"
          class="absolute bottom-6 -right-5 p-3 size-10 bg-base-foreground"
          @click="resetOutputsScroll"
        >
          <i class="icon-[lucide--arrow-up] size-4 bg-base-background" />
        </Button>
      </SplitterPanel>
      <SplitterPanel
        :size="98"
        class="flex flex-col min-w-min gap-4 mx-12 my-8"
        @wheel="handleCenterWheel"
      >
        <div class="flex gap-4 text-muted-foreground h-14 w-full items-center">
          <div
            v-for="({ content, iconClass }, index) in itemStats"
            :key="index"
          >
            <i v-if="iconClass" :class="iconClass" />
            {{ content }}
          </div>
          <div class="grow" />
          <Button class="px-4 py-2">
            <span>{{ t('Rerun') }}</span
            ><i class="icon-[lucide--refresh-cw]" />
          </Button>
          <Button class="px-4 py-2">
            <span>{{ t('ReuseParameters') }}</span
            ><i class="icon-[lucide--list-restart]" />
          </Button>
          <Divider layout="vertical" />
          <Button class="px-3 py-2">
            <i class="icon-[lucide--download]" />
          </Button>
          <Button class="px-3 py-2">
            <i class="icon-[lucide--ellipsis]" />
          </Button>
        </div>
        <img
          v-if="preview?.mediaType === 'images'"
          class="object-contain flex-1 max-h-full"
          :src="preview.url"
        />
        <!--FIXME: core videos are type 'images', VHS still wrapped as 'gifs'-->
        <video
          v-else-if="preview?.mediaType === 'gifs'"
          class="object-contain flex-1 min-h-0"
          controls
          :src="preview.url"
          @wheel.prevent
        />
        <img
          v-else
          class="pointer-events-none object-contain flex-1 max-h-full brightness-50 opacity-10"
          src="/assets/images/comfy-logo-mono.svg"
        />
      </SplitterPanel>
      <SplitterPanel :size="1" class="flex flex-col min-w-80">
        <div
          class="h-12 border-x border-border-subtle py-2 px-4 gap-2 bg-comfy-menu-bg flex items-center"
        >
          <span class="font-bold truncate min-w-30">
            {{ useWorkflowStore().activeWorkflow?.filename }}
          </span>
          <div class="flex-1" />
          <i class="icon-[lucide--info]" />
          <Button>{{ t('Publish') }}</Button>
        </div>
        <div
          class="border gap-2 h-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col px-2"
        >
          <div
            class="grow-1 justify-start flex-col overflow-y-auto contain-size *:max-h-100 flex"
          >
            <NodeWidgets
              v-for="nodeData of nodeDatas"
              :key="nodeData.id"
              :node-data
              class="border-b-1 border-node-component-border pt-1 pb-2 last:border-none **:[.col-span-2]:grid-cols-1 not-has-[textarea]:flex-0"
            />
          </div>
          <div class="p-4 pb-6 border-t border-node-component-border">
            <WidgetInputNumberInput
              v-model="batchCount"
              :widget="batchCountWidget"
              class="*:[.min-w-0]:w-24 grid-cols-[auto_96px]!"
            />
            <Button
              class="w-full mt-4 bg-primary-background h-10 text-sm"
              @click="runButtonClick"
            >
              <i class="icon-[lucide--play]" />
              {{ t('menu.run') }}
            </Button>
          </div>
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
