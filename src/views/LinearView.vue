<script setup lang="ts">
import {
  useEventListener,
  useInfiniteScroll,
  useScroll,
  useTimeout,
  whenever
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import ProgressSpinner from 'primevue/progressspinner'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import Load3dViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import SidebarIcon from '@/components/sidebar/SidebarIcon.vue'
import SidebarTemplatesButton from '@/components/sidebar/SidebarTemplatesButton.vue'
import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import Popover from '@/components/ui/Popover.vue'
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
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import VideoPreview from '@/renderer/extensions/linearMode/VideoPreview.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumber.vue'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useQueueSettingsStore, useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'
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

const displayWorkflows = ref(false)
const showNoteData = ref(false)
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
const activeLoad = ref<[number, number]>([0, 0])
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
}
const { y: outputScrollState } = useScroll(outputsRef)

watch(activeLoad, () => {
  const [index, key] = activeLoad.value
  if (!outputsRef.value) return
  const outputElement = outputsRef.value?.children?.[index]?.children?.[key]
  if (!outputElement) return
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
  const workflow = getOutputAssetMetadata(item?.user_metadata)?.workflow
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
  activeLoad.value = [0, 0]

  runButtonClick(e)
}
const filteredOutputs = computed(() => {
  const currentId = workflowStore.activeWorkflow?.activeState?.id
  return outputs.media.value.filter(
    (item) =>
      getOutputAssetMetadata(item?.user_metadata)?.workflow?.id === currentId
  )
})

function allOutputs(item?: AssetItem) {
  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  if (!user_metadata?.allOutputs) return []
  return user_metadata.allOutputs
}

const activeItem = computed(() => {
  const [index] = activeLoad.value
  return filteredOutputs.value[index]
})

const preview = computed(() => {
  const [index, key] = activeLoad.value
  if (index >= 0 && key >= 0) {
    const output = allOutputs(filteredOutputs.value[index])[key]
    if (output) return output
  }
  return allOutputs(filteredOutputs.value[0])[0]
})

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
  '3d': {
    content: t('sideToolbar.mediaAssets.filter3D'),
    iconClass: 'icon-[lucide--box]'
  },
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
  }
}
function getMediaType(output?: ResultItemImpl) {
  if (!output) return ''
  if (output.isVideo) return 'video'
  return output.mediaType
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
    (activeOutput && mediaTypes[getMediaType(activeOutput)]) ?? {}
  ].filter((i) => !!i)
})

watch(
  () => filteredOutputs.value,
  () => {
    hasPreview.value = false

    //TODO: Consider replace with resetOutputsScroll?
    activeLoad.value = [0, 0]
  }
)

function gotoNextOutput() {
  const [index, key] = activeLoad.value
  if (index < 0 || key < 0) {
    activeLoad.value = [0, 0]
    return
  }
  const currentItem = filteredOutputs.value[index]
  if (allOutputs(currentItem)[key + 1]) {
    activeLoad.value = [index, key + 1]
    return
  }
  if (filteredOutputs.value[index + 1]) {
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
    const currentItem = filteredOutputs.value[index - 1]
    activeLoad.value = [index - 1, allOutputs(currentItem).length - 1]
    return
  }
  activeLoad.value = [0, 0]
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

useEventListener(document.body, 'keydown', (e: KeyboardEvent) => {
  if (
    (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLInputElement
  )
    return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'ArrowDown') gotoNextOutput()
  else gotoPreviousOutput()
})

function downloadAsset(item: AssetItem) {
  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  for (const output of user_metadata?.allOutputs ?? [])
    downloadFile(output.url, output.filename)
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
      <SplitterPanel
        id="linearLeftPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <div />
      </SplitterPanel>
      <SplitterPanel
        id="linearCenterPanel"
        :size="98"
        class="flex flex-col min-w-min gap-4 mx-2 px-10 pt-8 pb-4 relative text-muted-foreground outline-none"
        @wheel.capture="handleCenterWheel"
      >
        <div id="linearDockTopLeft" class="absolute z-20 top-4 left-4" />
        <div id="linearDockTopRight" class="absolute z-20 top-4 right-4" />
        <div id="linearDockBottomLeft" class="absolute z-20 bottom-4 left-4" />
        <div
          id="linearDockBottomRight"
          class="absolute z-20 bottom-4 right-4"
        />
      </SplitterPanel>
      <SplitterPanel
        id="linearRightPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <div />
      </SplitterPanel>
    </Splitter>
  </div>
  <teleport
    :to="
      settingStore.get('Comfy.Sidebar.Location') === 'left'
        ? '#linearLeftPanel'
        : '#linearRightPanel'
    "
  >
    <div
      :class="
        cn(
          'min-w-38 flex bg-comfy-menu-bg h-full',
          settingStore.get('Comfy.Sidebar.Location') === 'right' &&
            'flex-row-reverse'
        )
      "
    >
      <div
        class="h-full flex flex-col w-14 shrink-0 overflow-hidden items-center p-2 border-r border-node-component-border"
      >
        <SidebarIcon
          icon="icon-[comfy--workflow]"
          :selected="displayWorkflows"
          @click="displayWorkflows = !displayWorkflows"
        />
        <SidebarTemplatesButton />
        <div class="flex-1" />
        <div class="p-1 bg-secondary-background rounded-lg w-10">
          <Button
            class="disabled:opacity-100"
            size="icon"
            :title="t('linearMode.linearMode')"
            disabled
            variant="inverted"
          >
            <i class="icon-[lucide--panels-top-left]" />
          </Button>
          <Button
            size="icon"
            :title="t('linearMode.graphMode')"
            @click="useCanvasStore().linearMode = false"
          >
            <i class="icon-[comfy--workflow]" />
          </Button>
        </div>
      </div>
      <WorkflowsSidebarTab v-if="displayWorkflows" class="min-w-0" />
      <linear-outputs
        v-else
        ref="outputsRef"
        class="h-full min-w-24 grow-1 p-3 overflow-y-auto border-r-1 border-node-component-border flex flex-col items-center contain-size"
      >
        <linear-job
          v-if="queueStore.runningTasks.length > 0"
          class="py-3 w-full aspect-square px-1 relative"
        >
          <ProgressSpinner class="size-full" />
          <div
            v-if="
              queueStore.runningTasks.length + queueStore.pendingTasks.length >
              1
            "
            class="absolute top-0 right-0 p-1 min-w-5 h-5 flex justify-center items-center rounded-full bg-primary-background text-text-primary"
            v-text="
              queueStore.runningTasks.length + queueStore.pendingTasks.length
            "
          />
        </linear-job>
        <linear-job
          v-for="(item, index) in filteredOutputs"
          :key="index"
          class="py-3 border-border-subtle flex flex-col w-full px-1 first:border-t-0 border-t-2"
        >
          <template v-for="(output, key) in allOutputs(item)" :key>
            <img
              v-if="getMediaType(output) === 'images'"
              :class="
                cn(
                  'p-1 rounded-lg aspect-square object-cover',
                  index === activeLoad[0] && key === activeLoad[1] && 'border-2'
                )
              "
              :src="output.url"
              @click="activeLoad = [index, key]"
            />
            <div
              v-else
              :class="
                cn(
                  'p-1 rounded-lg aspect-square w-full',
                  index === activeLoad[0] && key === activeLoad[1] && 'border-2'
                )
              "
            >
              <i
                :class="
                  cn(mediaTypes[getMediaType(output)]?.iconClass, 'size-full')
                "
              />
            </div>
          </template>
        </linear-job>
      </linear-outputs>
    </div>
    <teleport
      :to="
        settingStore.get('Comfy.Sidebar.Location') === 'left'
          ? '#linearDockBottomLeft'
          : '#linearDockBottomRight'
      "
    >
      <Button
        v-if="outputScrollState"
        :class="
          cn(
            'p-3 size-10 bg-base-foreground',
            settingStore.get('Comfy.Sidebar.Location') === 'left'
              ? 'left-4'
              : 'right-4'
          )
        "
        @click="resetOutputsScroll"
      >
        <i class="icon-[lucide--arrow-up] size-4 bg-base-background" />
      </Button>
    </teleport>
  </teleport>
  <teleport to="#linearCenterPanel">
    <linear-output-info
      v-if="activeItem"
      class="flex gap-2 p-1 w-full items-center z-10 tabular-nums"
    >
      <div
        v-for="({ content, iconClass }, index) in itemStats"
        :key="index"
        class="flex items-center justify-items-center gap-1 tabular-nums"
      >
        <i v-if="iconClass" :class="iconClass" />
        {{ content }}
      </div>
      <div class="grow" />
      <Button size="md" @click="rerun">
        {{ t('linearMode.rerun') }}
        <i class="icon-[lucide--refresh-cw]" />
      </Button>
      <Button size="md" @click="() => loadWorkflow(activeItem, activeLoad)">
        {{ t('linearMode.reuseParameters') }}
        <i class="icon-[lucide--list-restart]" />
      </Button>
      <div class="h-full border-r border-border-subtle mx-1" />
      <Button size="icon" @click="downloadFile(preview.url)">
        <i class="icon-[lucide--download]" />
      </Button>
      <Popover
        :entries="[
          [
            {
              icon: 'icon-[lucide--download]',
              label: t('linearMode.downloadAll'),
              action: () => downloadAsset(activeItem)
            }
          ],
          [
            {
              icon: 'icon-[lucide--trash-2]',
              label: t('queue.jobMenu.deleteAsset'),
              action: () => mediaActions.confirmDelete(activeItem)
            }
          ]
        ]"
      />
    </linear-output-info>
    <ImagePreview
      v-if="getMediaType(preview) === 'images'"
      :src="
        activeLoad[0] === 0 && activeLoad[1] === 0 && hasPreview
          ? nodeOutputStore.latestPreview[0]
          : preview.url
      "
    />
    <VideoPreview
      v-else-if="getMediaType(preview) === 'video'"
      :src="preview.url"
      class="object-contain flex-1 contain-size"
    />
    <audio
      v-else-if="getMediaType(preview) === 'audio'"
      class="w-full m-auto"
      controls
      :src="preview.url"
    />
    <article
      v-else-if="getMediaType(preview) === 'text'"
      class="w-full max-w-128 m-auto my-12 overflow-y-auto"
      v-text="preview.url"
    />
    <Load3dViewerContent
      v-else-if="getMediaType(preview) === '3d'"
      :model-url="preview.url"
    />
    <img
      v-else
      class="pointer-events-none object-contain flex-1 max-h-full brightness-50 opacity-10"
      src="/assets/images/comfy-logo-mono.svg"
    />
  </teleport>
  <teleport
    :to="
      settingStore.get('Comfy.Sidebar.Location') === 'left'
        ? '#linearRightPanel'
        : '#linearLeftPanel'
    "
  >
    <div class="flex flex-col min-w-80 h-full">
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
        class="border gap-2 h-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col px-2"
      >
        <linear-widgets
          class="grow-1 justify-start flex-col overflow-y-auto contain-size flex"
        >
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
                class="py-3 gap-y-4 **:[.col-span-2]:grid-cols-1 text-sm not-has-[textarea]:flex-0 **:[textarea]:h-35"
              />
            </DropZone>
          </template>
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
              class="w-10 p-2"
              @click="commandStore.execute('Comfy.Interrupt')"
            >
              <i class="icon-[lucide--x]" />
            </Button>
          </div>
        </linear-run-button>
      </div>
    </div>
    <teleport
      :to="
        settingStore.get('Comfy.Sidebar.Location') === 'left'
          ? '#linearDockBottomRight'
          : '#linearDockBottomLeft'
      "
    >
      <div
        v-if="!jobToastTimeout || !jobFinishedQueue"
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
    <teleport
      :to="
        settingStore.get('Comfy.Sidebar.Location') === 'left'
          ? '#linearDockTopRight'
          : '#linearDockTopLeft'
      "
    >
      <div
        v-if="showNoteData"
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
  </teleport>
</template>
