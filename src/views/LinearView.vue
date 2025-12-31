<script setup lang="ts">
import {
  onKeyStroke,
  useEventListener,
  useInfiniteScroll,
  useScroll,
  useTimeout,
  whenever
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import Popover from '@/components/ui/Popover.vue'
import ZoomPane from '@/components/ui/ZoomPane.vue'
import Button from '@/components/ui/button/Button.vue'
import { safeWidgetMapper } from '@/composables/graph/useGraphNodeManager'
import { d, t } from '@/i18n'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useQueueSettingsStore, useQueueStore } from '@/stores/queueStore'
import { collectAllNodes } from '@/utils/graphTraversalUtil'
import { executeWidgetsCallback } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

const commandStore = useCommandStore()
const executionStore = useExecutionStore()
const outputs = useMediaAssets('output')
const mediaActions = useMediaAssetActions()
const nodeOutputStore = useNodeOutputStore()
const queueStore = useQueueStore()
const settingStore = useSettingStore()
const { isActiveSubscription } = useSubscription()
const workflowStore = useWorkflowStore()

void outputs.fetchMediaList()

const isRunning = computed(() => queueStore.runningTasks.length > 0)
const hasPreview = ref(false)
whenever(
  () => nodeOutputStore.latestPreview[0],
  () => (hasPreview.value = true)
)

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
    const dropIndicator =
      node.type !== 'LoadImage'
        ? undefined
        : {
            iconClass: 'icon-[lucide--image]',
            label: t('Click to browse or drag an image')
          }
    //Only widgets is actually used
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

//FIXME: actually implement this
const jobFinishedQueue = ref(true)
const {
  ready: jobToastTimeout,
  start: resetJobToastTimeout,
  stop: stopJobTimeout
} = useTimeout(5000, { controls: true })
stopJobTimeout()

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
async function rerun(e: Event) {
  loadWorkflow(activeItem.value, activeLoad.value)
  //FIXME don't use timeouts here
  //Currently seeds fail to properly update even with timeouts?
  await new Promise((r) => setTimeout(r, 500))
  executeWidgetsCallback(collectAllNodes(app.rootGraph), 'afterQueued')
  activeLoad.value = [-1, -1]

  runButtonClick(e)
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
  audio: {
    content: t('sideToolbar.mediaAssets.filterAudio'),
    iconClass: 'icon-[lucide--audio-lines]'
  },
  images: {
    content: t('sideToolbar.mediaAssets.filterImage'),
    iconClass: 'icon-[lucide--image]'
  },
  text: {
    content: t('sideToolbar.mediaAssets.filterText'),
    iconClass: 'icon-[lucide--text]'
  },
  video: {
    content: t('sideToolbar.mediaAssets.filterVideo'),
    iconClass: 'icon-[lucide--video]'
  },
  gifs: {
    content: t('sideToolbar.mediaAssets.filterVideo'),
    iconClass: 'icon-[lucide--video]'
  }
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

watch(
  () => outputs.media.value,
  () => {
    hasPreview.value = false

    //TODO: Consider replace with resetOutputsScroll?
    activeLoad.value = [-1, -1]
  }
)

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

let pointer = new CanvasPointer(document.body)
let scrollOffset = 0
function handleCenterWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  e.stopPropagation()

  if (!pointer.isTrackpadGesture(e)) {
    if (e.deltaY > 0) gotoNextOutput()
    else gotoPreviousOutput()
    return
  }
  scrollOffset += e.deltaY * 0.5
  while (scrollOffset >= 60) {
    scrollOffset -= 60
    gotoNextOutput()
  }
  while (scrollOffset <= -60) {
    scrollOffset += 60
    gotoPreviousOutput()
  }
}
onKeyStroke('ArrowDown', gotoNextOutput)
onKeyStroke('ArrowUp', gotoPreviousOutput)
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
      :class="
        cn(
          'h-[calc(100%-38px)] w-full bg-comfy-menu-secondary-bg',
          settingStore.get('Comfy.Sidebar.Location') === 'right' &&
            'flex-row-reverse'
        )
      "
      :pt="{ gutter: { class: 'bg-transparent w-4 -mx-3' } }"
      @resizestart="({ originalEvent }) => originalEvent.preventDefault()"
    >
      <SplitterPanel :size="1" class="min-w-38 bg-comfy-menu-bg flex">
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
        <linear-outputs
          ref="outputsRef"
          class="h-full min-w-24 grow-1 p-3 overflow-y-auto border-r-1 border-node-component-border flex flex-col items-center"
        >
          <linear-job v-if="isRunning" class="py-3 w-full aspect-square px-1">
            <ProgressSpinner class="size-full" />
          </linear-job>
          <linear-job
            v-for="(item, index) in outputs.media.value"
            :key="index"
            class="py-3 border-border-subtle flex flex-col w-full px-1 first:border-t-0 border-t-2"
          >
            <template v-for="(output, key) in allOutputs(item)" :key>
              <img
                v-if="output.mediaType === 'images'"
                :class="
                  cn(
                    'p-1 rounded-lg aspect-square object-cover',
                    index === activeLoad[0] &&
                      key === activeLoad[1] &&
                      'border-2'
                  )
                "
                :src="output.url"
                @click="loadWorkflow(item, [index, key])"
              />
              <div
                v-else
                :class="
                  cn(
                    'p-1 rounded-lg aspect-square w-full',
                    index === activeLoad[0] &&
                      key === activeLoad[1] &&
                      'border-2'
                  )
                "
              >
                <i
                  :class="
                    cn(mediaTypes[output.mediaType].iconClass, 'size-full')
                  "
                />
              </div>
            </template>
          </linear-job>
        </linear-outputs>
      </SplitterPanel>
      <SplitterPanel
        :size="98"
        class="flex flex-col min-w-min gap-4 mx-12 my-8 relative"
        @wheel.capture="handleCenterWheel"
      >
        <linear-output-info
          v-if="activeItem"
          class="flex gap-2 p-1 text-muted-foreground w-full items-center"
        >
          <div
            v-for="({ content, iconClass }, index) in itemStats"
            :key="index"
            class="flex items-center justify-items-center gap-1"
          >
            <i v-if="iconClass" :class="iconClass" />
            {{ content }}
          </div>
          <div class="grow" />
          <Button size="md" @click="rerun">
            {{ t('Rerun') }}
            <i class="icon-[lucide--refresh-cw]" />
          </Button>
          <Button size="md" @click="() => loadWorkflow(activeItem, activeLoad)">
            {{ t('ReuseParameters') }}
            <i class="icon-[lucide--list-restart]" />
          </Button>
          <Divider layout="vertical" class="mx-1" />
          <Button size="icon" @click="downloadFile(preview.url)">
            <i class="icon-[lucide--download]" />
          </Button>
          <Popover
            :entries="[
              [
                {
                  icon: 'icon-[lucide--download]',
                  label: t('DownloadAll'),
                  action: () => mediaActions.downloadAsset(activeItem)
                }
              ],
              [
                {
                  icon: 'icon-[lucide--trash-2]',
                  label: t('DeleteAsset'),
                  action: () => mediaActions.confirmDelete(activeItem)
                }
              ]
            ]"
            icon="icon-[lucide--ellipsis]"
          />
        </linear-output-info>
        <ZoomPane
          v-if="preview?.mediaType === 'images'"
          v-slot="slotProps"
          class="flex-1 w-full"
        >
          <img
            v-if="activeLoad[0] === -1 && activeLoad[1] === -1 && hasPreview"
            :src="nodeOutputStore.latestPreview[0]"
            v-bind="slotProps"
          />
          <img v-else :src="preview.url" v-bind="slotProps" />
        </ZoomPane>
        <!--FIXME: core videos are type 'images', VHS still wrapped as 'gifs'-->
        <video
          v-else-if="preview?.mediaType === 'gifs'"
          class="object-contain flex-1 contain-size"
          controls
          :src="preview.url"
        />
        <audio
          v-else-if="preview?.mediaType === 'audio'"
          class="w-full m-auto"
          controls
          :src="preview.url"
        />
        <article
          v-else-if="preview?.mediaType === 'text'"
          class="w-full max-w-128 m-auto my-12 overflow-y-auto"
          controls
          v-text="preview.url"
        />
        <img
          v-else
          class="pointer-events-none object-contain flex-1 max-h-full brightness-50 opacity-10"
          src="/assets/images/comfy-logo-mono.svg"
        />
        <Button
          v-if="
            outputScrollState || activeLoad[0] !== -1 || activeLoad[1] !== -1
          "
          class="absolute bottom-0 left-0 p-3 size-10 bg-base-foreground"
          @click="resetOutputsScroll"
        >
          <i class="icon-[lucide--arrow-up] size-4 bg-base-background" />
        </Button>
        <div
          v-if="!jobToastTimeout || !jobFinishedQueue"
          class="absolute right-0 bottom-0 bg-base-foreground text-base-background rounded-sm flex h-8 p-1 pr-2 gap-2 items-center"
        >
          <i
            v-if="jobFinishedQueue"
            class="icon-[lucide--check] size-5 bg-success-background"
          />
          <ProgressSpinner v-else class="size-4" />
          <span v-text="t('Job added to queue')" />
        </div>
      </SplitterPanel>
      <SplitterPanel :size="1" class="flex flex-col min-w-80">
        <linear-workflow-info
          class="h-12 border-x border-border-subtle py-2 px-4 gap-2 bg-comfy-menu-bg flex items-center"
        >
          <span
            class="font-bold truncate min-w-30"
            v-text="workflowStore.activeWorkflow?.filename"
          />
          <div class="flex-1" />
          <i class="icon-[lucide--info]" />
          <Button> {{ t('publish') }} </Button>
        </linear-workflow-info>
        <div
          class="border gap-2 h-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col px-2"
        >
          <linear-widgets
            class="grow-1 justify-start flex-col overflow-y-auto contain-size *:max-h-100 flex"
          >
            <DropZone
              v-for="nodeData of nodeDatas"
              :key="nodeData.id"
              :on-drag-over="nodeData.onDragOver"
              :on-drag-drop="nodeData.onDragDrop"
              :drop-indicator="nodeData.dropIndicator"
            >
              <NodeWidgets
                :node-data
                class="border-b-1 border-node-component-border pt-1 pb-2 last:border-none **:[.col-span-2]:grid-cols-1 not-has-[textarea]:flex-0"
              />
            </DropZone>
          </linear-widgets>
          <linear-run-button
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
                @click="console.error('not implemented')"
              >
                <i class="icon-[lucide--x]" />
              </Button>
            </div>
          </linear-run-button>
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
