<script setup lang="ts">
import {
  useAsyncState,
  useEventListener,
  useInfiniteScroll,
  useScroll
} from '@vueuse/core'
import { computed, ref, toRaw, toValue, useTemplateRef, watch } from 'vue'
import type { MaybeRef } from 'vue'

import ModeToggle from '@/components/sidebar/ModeToggle.vue'
import SidebarIcon from '@/components/sidebar/SidebarIcon.vue'
import SidebarTemplatesButton from '@/components/sidebar/SidebarTemplatesButton.vue'
import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import Button from '@/components/ui/button/Button.vue'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import type { NodeExecutionOutput, ResultItem } from '@/schemas/apiSchema'
import { getJobDetail } from '@/services/jobOutputCache'
import { useQueueStore, ResultItemImpl } from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { cn } from '@/utils/tailwindUtil'

const displayWorkflows = ref(false)
const outputs = useMediaAssets('output')
const {
  progressBarContainerClass,
  progressBarPrimaryClass,
  progressBarSecondaryClass,
  progressPercentStyle
} = useProgressBarBackground()
const { totalPercent, currentNodePercent } = useQueueProgress()
const queueStore = useQueueStore()
const settingStore = useSettingStore()

const workflowTab = useWorkspaceStore()
  .getSidebarTabs()
  .find((w) => w.id === 'workflows')

void outputs.fetchMediaList()

defineProps<{
  scrollResetButtonTo?: string | HTMLElement
  mobile?: boolean
}>()
const emit = defineEmits<{
  updateSelection: [
    selection: [AssetItem | undefined, ResultItemImpl | undefined, boolean]
  ]
}>()

defineExpose({ onWheel })

const selectedIndex = ref<[number, number]>([-1, 0])

function doEmit() {
  const [index] = selectedIndex.value
  emit('updateSelection', [
    outputs.media.value[index],
    selectedOutput.value,
    selectedIndex.value[0] <= 0
  ])
}

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

watch(selectedIndex, () => {
  const [index, key] = selectedIndex.value
  if (!outputsRef.value) return

  const outputElement = outputsRef.value?.querySelectorAll(
    `[data-output-index="${index}"]`
  )?.[key]
  if (!outputElement) return

  //container: 'nearest' is nice, but bleeding edge and chrome only
  outputElement.scrollIntoView({ block: 'nearest' })
})

function outputCount(item?: AssetItem) {
  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  return user_metadata?.outputCount ?? 0
}

const outputsCache: Record<string, MaybeRef<ResultItemImpl[]>> = {}

function flattenNodeOutput([nodeId, nodeOutput]: [
  string | number,
  NodeExecutionOutput
]): ResultItemImpl[] {
  const knownOutputs: Record<string, ResultItem[]> = {}
  if (nodeOutput.audio) knownOutputs.audio = nodeOutput.audio
  if (nodeOutput.images) knownOutputs.images = nodeOutput.images
  if (nodeOutput.video) knownOutputs.video = nodeOutput.video
  if (nodeOutput.gifs) knownOutputs.gifs = nodeOutput.gifs as ResultItem[]
  if (nodeOutput['3d']) knownOutputs['3d'] = nodeOutput['3d'] as ResultItem[]

  return Object.entries(knownOutputs).flatMap(([mediaType, outputs]) =>
    outputs.map(
      (output) => new ResultItemImpl({ ...output, mediaType, nodeId })
    )
  )
}

function allOutputs(item?: AssetItem): MaybeRef<ResultItemImpl[]> {
  if (item?.id && outputsCache[item.id]) return outputsCache[item.id]

  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  if (!user_metadata) return []
  if (
    user_metadata.allOutputs &&
    user_metadata.outputCount &&
    user_metadata.outputCount < user_metadata.allOutputs.length
  )
    return user_metadata.allOutputs

  const outputRef = useAsyncState(
    getJobDetail(user_metadata.promptId).then((jobDetail) => {
      if (!jobDetail?.outputs) return []
      return Object.entries(jobDetail.outputs).flatMap(flattenNodeOutput)
    }),
    []
  ).state
  outputsCache[item!.id] = outputRef
  return outputRef
}

const selectedOutput = computed(() => {
  const [index, key] = selectedIndex.value
  if (index < 0) return undefined

  return toValue(allOutputs(outputs.media.value[index]))[key]
})

watch([selectedIndex, selectedOutput], doEmit)
watch(
  () => outputs.media.value,
  (newAssets, oldAssets) => {
    if (
      newAssets.length === oldAssets.length ||
      (oldAssets.length === 0 && newAssets.length !== 1)
    )
      return
    if (selectedIndex.value[0] <= 0) {
      selectedIndex.value = [0, 0]
      return
    }

    const oldId = toRaw(oldAssets[selectedIndex.value[0]]?.id)
    const newIndex = toRaw(newAssets).findIndex((asset) => asset?.id === oldId)

    if (newIndex === -1) selectedIndex.value = [0, 0]
    else selectedIndex.value = [newIndex, selectedIndex.value[1]]
  }
)

function gotoNextOutput() {
  const [index, key] = selectedIndex.value
  if (index < 0 || key < 0) {
    selectedIndex.value = [0, 0]
    return
  }
  if (key + 1 < outputCount(outputs.media.value[index])) {
    selectedIndex.value = [index, key + 1]
    return
  }
  if (outputs.media.value[index + 1]) {
    selectedIndex.value = [index + 1, 0]
  }
  //do nothing, no next output
}

function gotoPreviousOutput() {
  const [index, key] = selectedIndex.value
  if (key > 0) {
    selectedIndex.value = [index, key - 1]
    return
  }

  if (index > 0) {
    const len = outputCount(outputs.media.value[index - 1])
    selectedIndex.value = [index - 1, len - 1]
    return
  }

  selectedIndex.value = [0, 0]
}

let pointer = new CanvasPointer(document.body)
let scrollOffset = 0
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  e.stopPropagation()

  if (!pointer.isTrackpadGesture(e)) {
    if (e.deltaY > 0) gotoNextOutput()
    else gotoPreviousOutput()
    return
  }
  scrollOffset += e.deltaY
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
</script>
<template>
  <div
    :class="
      cn(
        'min-w-38 flex bg-comfy-menu-bg md:h-full border-border-subtle',
        settingStore.get('Comfy.Sidebar.Location') === 'right'
          ? 'flex-row-reverse border-l'
          : 'md:border-r'
      )
    "
    v-bind="$attrs"
  >
    <div
      v-if="!mobile"
      class="h-full flex flex-col w-14 shrink-0 overflow-hidden items-center p-2"
    >
      <template v-if="workflowTab">
        <SidebarIcon
          :icon="workflowTab.icon"
          :icon-badge="workflowTab.iconBadge"
          :tooltip="workflowTab.tooltip"
          :label="workflowTab.label || workflowTab.title"
          :class="workflowTab.id + '-tab-button'"
          :selected="displayWorkflows"
          :is-small="settingStore.get('Comfy.Sidebar.Size') === 'small'"
          @click="displayWorkflows = !displayWorkflows"
        />
      </template>
      <SidebarTemplatesButton />
      <div class="flex-1" />
      <ModeToggle />
    </div>
    <div class="border-border-subtle md:border-r" />
    <WorkflowsSidebarTab v-if="displayWorkflows" class="min-w-50 grow-1" />
    <article
      v-else
      ref="outputsRef"
      data-testid="linear-outputs"
      class="h-24 md:h-full min-w-24 grow-1 p-3 overflow-x-auto overflow-y-clip md:overflow-y-auto md:overflow-x-clip md:border-r-1 border-node-component-border flex md:flex-col items-center contain-size"
    >
      <section
        v-if="
          queueStore.runningTasks.length > 0 ||
          queueStore.pendingTasks.length > 0
        "
        data-testid="linear-job"
        class="py-3 not-md:h-24 md:w-full aspect-square px-1 relative"
      >
        <i
          v-if="queueStore.runningTasks.length > 0"
          class="icon-[lucide--loader-circle] size-full animate-spin"
        />
        <i v-else class="icon-[lucide--ellipsis] size-full animate-pulse" />
        <div
          v-if="
            queueStore.runningTasks.length + queueStore.pendingTasks.length > 1
          "
          class="absolute top-0 right-0 p-1 min-w-5 h-5 flex justify-center items-center rounded-full bg-primary-background text-text-primary"
          v-text="
            queueStore.runningTasks.length + queueStore.pendingTasks.length
          "
        />
        <div class="absolute -bottom-1 w-full h-3 rounded-sm overflow-clip">
          <div :class="progressBarContainerClass">
            <div
              :class="progressBarPrimaryClass"
              :style="progressPercentStyle(totalPercent)"
            />
            <div
              :class="progressBarSecondaryClass"
              :style="progressPercentStyle(currentNodePercent)"
            />
          </div>
        </div>
      </section>
      <template v-for="(item, index) in outputs.media.value" :key="index">
        <div
          class="border-border-subtle not-md:border-l md:border-t first:border-none not-md:h-21 md:w-full m-3"
        />
        <template v-for="(output, key) in toValue(allOutputs(item))" :key>
          <img
            v-if="getMediaType(output) === 'images'"
            :class="
              cn(
                'p-1 rounded-lg aspect-square object-cover not-md:h-20 md:w-full',
                index === selectedIndex[0] &&
                  key === selectedIndex[1] &&
                  'border-2'
              )
            "
            :data-output-index="index"
            :src="output.url"
            @click="selectedIndex = [index, key]"
          />
          <div
            v-else
            :class="
              cn(
                'p-1 rounded-lg aspect-square w-full',
                index === selectedIndex[0] &&
                  key === selectedIndex[1] &&
                  'border-2'
              )
            "
            :data-output-index="index"
            @click="selectedIndex = [index, key]"
          >
            <i
              :class="
                cn(mediaTypes[getMediaType(output)]?.iconClass, 'size-full')
              "
            />
          </div>
        </template>
      </template>
    </article>
  </div>
  <Teleport
    v-if="outputScrollState && scrollResetButtonTo"
    :to="scrollResetButtonTo"
  >
    <Button
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
  </Teleport>
</template>
