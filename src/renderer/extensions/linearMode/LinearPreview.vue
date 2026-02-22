<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LinearWelcome from '@/renderer/extensions/linearMode/LinearWelcome.vue'
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
// Lazy-loaded to avoid pulling THREE.js into the main bundle
const Preview3d = () => import('@/renderer/extensions/linearMode/Preview3d.vue')
import VideoPreview from '@/renderer/extensions/linearMode/VideoPreview.vue'
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import type { StatItem } from '@/renderer/extensions/linearMode/mediaTypes'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type { ResultItemImpl } from '@/stores/queueStore'
import { formatDuration } from '@/utils/dateTimeUtil'
import { collectAllNodes } from '@/utils/graphTraversalUtil'
import { executeWidgetsCallback } from '@/utils/litegraphUtil'

const { t, d } = useI18n()
const mediaActions = useMediaAssetActions()
const nodeOutputStore = useNodeOutputStore()

const { runButtonClick } = defineProps<{
  runButtonClick?: (e: Event) => void
  mobile?: boolean
}>()

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)
const latentPreview = ref<string>()
whenever(
  () => nodeOutputStore.latestPreview[0],
  () => (latentPreview.value = nodeOutputStore.latestPreview[0])
)

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

function formatTime(time?: string) {
  if (!time) return ''
  const date = new Date(time)
  return `${d(date, dateOptions)} | ${d(date, timeOptions)}`
}

const itemStats = computed<StatItem[]>(() => {
  if (!selectedItem.value) return []
  const user_metadata = getOutputAssetMetadata(selectedItem.value.user_metadata)
  if (!user_metadata) return []

  const { allOutputs } = user_metadata
  return [
    { content: formatTime(selectedItem.value.created_at) },
    { content: formatDuration(user_metadata.executionTimeInSeconds) },
    allOutputs && { content: t('g.asset', allOutputs.length) },
    (selectedOutput.value && mediaTypes[getMediaType(selectedOutput.value)]) ??
      {}
  ].filter((i) => !!i)
})

function downloadAsset(item?: AssetItem) {
  const user_metadata = getOutputAssetMetadata(item?.user_metadata)
  for (const output of user_metadata?.allOutputs ?? [])
    downloadFile(output.url, output.filename)
}

async function loadWorkflow(item: AssetItem | undefined) {
  if (!item) return
  const { workflow } = await extractWorkflowFromAsset(item)
  if (!workflow) return

  if (workflow.id !== app.rootGraph.id) return app.loadGraphData(workflow)
  //update graph to new version, set old to top of undo queue
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) return app.loadGraphData(workflow)
  changeTracker.redoQueue = []
  changeTracker.updateState([workflow], changeTracker.undoQueue)
}

async function rerun(e: Event) {
  if (!runButtonClick) return
  await loadWorkflow(selectedItem.value)
  //FIXME don't use timeouts here
  //Currently seeds fail to properly update even with timeouts?
  await new Promise((r) => setTimeout(r, 500))
  executeWidgetsCallback(collectAllNodes(app.rootGraph), 'afterQueued')

  runButtonClick(e)
}
</script>
<template>
  <section
    v-if="selectedItem"
    data-testid="linear-output-info"
    class="flex flex-wrap gap-2 p-1 w-full md:z-10 tabular-nums justify-between text-sm"
  >
    <div class="flex gap-3 text-nowrap">
      <div
        v-for="({ content, iconClass }, index) in itemStats"
        :key="index"
        class="flex items-center justify-items-center gap-1 tabular-nums"
      >
        <i v-if="iconClass" :class="iconClass" />
        {{ content }}
      </div>
    </div>
    <div class="flex gap-3 justify-self-end">
      <Button size="md" @click="rerun">
        {{ t('linearMode.rerun') }}
        <i class="icon-[lucide--refresh-cw]" />
      </Button>
      <Button size="md" @click="() => loadWorkflow(selectedItem)">
        {{ t('linearMode.reuseParameters') }}
        <i class="icon-[lucide--list-restart]" />
      </Button>
      <div class="border-r border-border-subtle mx-1" />
      <Button
        size="icon"
        @click="
          () => {
            if (selectedOutput?.url) downloadFile(selectedOutput.url)
          }
        "
      >
        <i class="icon-[lucide--download]" />
      </Button>
      <Popover
        :entries="[
          {
            icon: 'icon-[lucide--download]',
            label: t('linearMode.downloadAll'),
            command: () => downloadAsset(selectedItem!)
          },
          { separator: true },
          {
            icon: 'icon-[lucide--trash-2]',
            label: t('queue.jobMenu.deleteAsset'),
            command: () => mediaActions.deleteAssets(selectedItem!)
          }
        ]"
      />
    </div>
  </section>
  <ImagePreview
    v-if="
      (canShowPreview && latentPreview) ||
      getMediaType(selectedOutput) === 'images'
    "
    :mobile
    :src="(canShowPreview && latentPreview) || selectedOutput!.url"
  />
  <VideoPreview
    v-else-if="getMediaType(selectedOutput) === 'video'"
    :src="selectedOutput!.url"
    class="object-contain flex-1 md:contain-size md:p-3"
  />
  <audio
    v-else-if="getMediaType(selectedOutput) === 'audio'"
    class="w-full m-auto"
    controls
    :src="selectedOutput!.url"
  />
  <article
    v-else-if="getMediaType(selectedOutput) === 'text'"
    class="w-full max-w-128 m-auto my-12 overflow-y-auto"
    v-text="selectedOutput!.url"
  />
  <Preview3d
    v-else-if="getMediaType(selectedOutput) === '3d'"
    :model-url="selectedOutput!.url"
  />
  <LinearWelcome v-else />
  <OutputHistory
    @update-selection="
      (event) => {
        ;[selectedItem, selectedOutput, canShowPreview] = event
        latentPreview = undefined
      }
    "
  />
</template>
