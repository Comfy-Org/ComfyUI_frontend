<script setup lang="ts">
import { useEventListener, useInfiniteScroll, useScroll } from '@vueuse/core'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, useTemplateRef, watch } from 'vue'

import SidebarIcon from '@/components/sidebar/SidebarIcon.vue'
import SidebarTemplatesButton from '@/components/sidebar/SidebarTemplatesButton.vue'
import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import Button from '@/components/ui/button/Button.vue'
import { t } from '@/i18n'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const displayWorkflows = ref(false)
const outputs = useMediaAssets('output')
const queueStore = useQueueStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()

void outputs.fetchMediaList()

defineProps<{
  scrollResetButtonTo: string | HTMLElement
  horizontal?: boolean
}>()
const emit = defineEmits<{
  (
    e: 'updateSelection',
    selection: [AssetItem, ResultItemImpl, [number, number]]
  ): void
}>()

defineExpose({ onWheel })

const selectedIndex = ref<[number, number]>([0, 0])

watch(selectedIndex, () => {
  const [index] = selectedIndex.value
  emit('updateSelection', [
    filteredOutputs.value[index],
    selectedOutput.value,
    selectedIndex.value
  ])
})

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
  const outputElement = outputsRef.value?.children?.[index]?.children?.[key]
  if (!outputElement) return
  //container: 'nearest' is nice, but bleeding edge and chrome only
  outputElement.scrollIntoView({ block: 'nearest' })
})

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

const selectedOutput = computed(() => {
  const [index, key] = selectedIndex.value
  if (index >= 0 && key >= 0) {
    const output = allOutputs(filteredOutputs.value[index])[key]
    if (output) return output
  }
  return allOutputs(filteredOutputs.value[0])[0]
})

watch(
  () => filteredOutputs.value,
  () => {
    //TODO: Consider replace with resetOutputsScroll?
    selectedIndex.value = [0, 0]
  }
)

function gotoNextOutput() {
  const [index, key] = selectedIndex.value
  if (index < 0 || key < 0) {
    selectedIndex.value = [0, 0]
    return
  }
  const currentItem = filteredOutputs.value[index]
  if (allOutputs(currentItem)[key + 1]) {
    selectedIndex.value = [index, key + 1]
    return
  }
  if (filteredOutputs.value[index + 1]) {
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
    const currentItem = filteredOutputs.value[index - 1]
    selectedIndex.value = [index - 1, allOutputs(currentItem).length - 1]
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
        'min-w-38 flex bg-comfy-menu-bg h-full',
        settingStore.get('Comfy.Sidebar.Location') === 'right' &&
          'flex-row-reverse',
        horizontal && 'h-30'
      )
    "
    v-bind="$attrs"
  >
    <div
      v-if="!horizontal"
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
    <WorkflowsSidebarTab v-if="displayWorkflows" class="min-w-50" />
    <linear-outputs
      v-else
      ref="outputsRef"
      :class="
        cn(
          'min-w-24 grow-1 p-3 border-r-1 border-node-component-border flex items-center contain-size',
          horizontal ? 'overflow-x-auto' : 'flex-col overflow-y-auto w-full'
        )
      "
    >
      <linear-job
        v-if="queueStore.runningTasks.length > 0"
        class="py-3 aspect-square px-1 relative"
      >
        <ProgressSpinner class="size-full" />
        <div
          v-if="
            queueStore.runningTasks.length + queueStore.pendingTasks.length > 1
          "
          class="absolute top-0 right-0 p-1 min-w-5 h-5 justify-center items-center rounded-full bg-primary-background text-text-primary"
          v-text="
            queueStore.runningTasks.length + queueStore.pendingTasks.length
          "
        />
      </linear-job>
      <linear-job
        v-for="(item, index) in filteredOutputs"
        :key="index"
        :class="
          cn(
            'border-border-subtle flex',
            horizontal
              ? 'h-full px-3 py-1 first:border-l-0 border-l-2'
              : 'flex-col w-full py-3 px-1 first:border-t-0 border-t-2'
          )
        "
      >
        <template v-for="(output, key) in allOutputs(item)" :key>
          <img
            v-if="getMediaType(output) === 'images'"
            :class="
              cn(
                'p-1 rounded-lg aspect-square object-cover',
                index === selectedIndex[0] &&
                  key === selectedIndex[1] &&
                  'border-2'
              )
            "
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
  </teleport>
</template>
