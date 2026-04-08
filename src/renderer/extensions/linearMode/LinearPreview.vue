<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import ImageLightbox from '@/components/common/ImageLightbox.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import LinearWelcome from '@/renderer/extensions/linearMode/LinearWelcome.vue'
import LinearArrange from '@/renderer/extensions/linearMode/LinearArrange.vue'
import LinearFeedback from '@/renderer/extensions/linearMode/LinearFeedback.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import OutputGrid from '@/renderer/extensions/linearMode/OutputGrid.vue'
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import type { OutputSelection } from '@/renderer/extensions/linearMode/linearModeTypes'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import type { ResultItemImpl } from '@/stores/queueStore'

const { t } = useI18n()
const mediaActions = useMediaAssetActions()
const appModeStore = useAppModeStore()
const { isBuilderMode, isArrangeMode } = useAppMode()
const { allOutputs, isWorkflowActive, cancelActiveWorkflowJobs } =
  useOutputHistory()
const { runButtonClick, mobile, typeformWidgetId } = defineProps<{
  runButtonClick?: (e: Event) => void
  mobile?: boolean
  typeformWidgetId?: string
}>()

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)
const latentPreview = ref<string>()
const showSkeleton = ref(false)
const lightboxUrl = ref('')
const lightboxOpen = ref(false)

function openLightbox(url: string) {
  if (mobile) {
    document
      .querySelectorAll<HTMLMediaElement>('video, audio')
      .forEach((el) => el.pause())
  }
  lightboxUrl.value = url
  lightboxOpen.value = true
}

const isMultiOutput = computed(() => appModeStore.selectedOutputs.length > 1)

const outputsByNode = computed(() => {
  const map = new Map<string, ResultItemImpl>()
  if (!selectedItem.value) return map
  const outputs = allOutputs(selectedItem.value)
  const outputLookup = new Map<string, ResultItemImpl>()
  for (const output of outputs) {
    if (!outputLookup.has(String(output.nodeId))) {
      outputLookup.set(String(output.nodeId), output)
    }
  }
  for (const nodeId of appModeStore.selectedOutputs) {
    const output = outputLookup.get(String(nodeId))
    if (output) map.set(String(nodeId), output)
  }
  return map
})

function handleSelection(sel: OutputSelection) {
  selectedItem.value = sel.asset
  selectedOutput.value = sel.output
  canShowPreview.value = sel.canShowPreview
  latentPreview.value = sel.latentPreviewUrl
  showSkeleton.value = sel.showSkeleton ?? false
}

function downloadAsset(item?: AssetItem) {
  for (const output of allOutputs(item))
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
  await changeTracker.updateState([workflow], changeTracker.undoQueue)
}

async function rerun(e: Event) {
  if (!runButtonClick) return
  await loadWorkflow(selectedItem.value)
  runButtonClick(e)
}
</script>
<template>
  <section
    v-if="selectedItem || selectedOutput || showSkeleton || isWorkflowActive"
    data-testid="linear-output-info"
    class="flex w-full flex-wrap justify-center gap-2 p-4 text-sm tabular-nums md:z-10"
  >
    <template v-if="selectedItem">
      <Button size="md" @click="rerun">
        {{ t('linearMode.rerun') }}
        <i class="icon-[lucide--refresh-cw]" />
      </Button>
      <Button size="md" @click="() => loadWorkflow(selectedItem)">
        {{ t('linearMode.reuseParameters') }}
        <i class="icon-[lucide--list-restart]" />
      </Button>
      <div class="mx-1 border-r border-border-subtle" />
    </template>
    <Button
      v-if="selectedOutput"
      v-tooltip.top="t('g.download')"
      size="icon"
      :aria-label="t('g.download')"
      @click="
        () => {
          if (selectedOutput?.url) downloadFile(selectedOutput.url)
        }
      "
    >
      <i class="icon-[lucide--download]" />
    </Button>
    <Button
      v-if="isWorkflowActive && !selectedItem"
      variant="destructive"
      @click="cancelActiveWorkflowJobs()"
    >
      <i class="icon-[lucide--x]" />
      {{ t('linearMode.cancelThisRun') }}
    </Button>
    <Popover
      v-if="selectedItem"
      :entries="[
        ...(allOutputs(selectedItem).length > 1
          ? [
              {
                icon: 'icon-[lucide--download]',
                label: t('linearMode.downloadAll', {
                  count: allOutputs(selectedItem).length
                }),
                command: () => downloadAsset(selectedItem)
              },
              { separator: true }
            ]
          : []),
        {
          icon: 'icon-[lucide--trash-2]',
          label: t('linearMode.deleteAllAssets'),
          command: () => mediaActions.deleteAssets(selectedItem!)
        }
      ]"
    />
  </section>
  <OutputGrid
    v-if="isMultiOutput && outputsByNode.size > 0"
    :outputs-by-node="outputsByNode"
    :output-count="appModeStore.selectedOutputs.length"
    :show-skeleton="showSkeleton"
    :mobile
    @open-lightbox="openLightbox"
  />
  <ImagePreview
    v-else-if="canShowPreview && latentPreview"
    :mobile
    :src="latentPreview"
    :show-size="false"
  />
  <MediaOutputPreview
    v-else-if="selectedOutput"
    :output="selectedOutput"
    :mobile
    @dblclick="
      !mobile && selectedOutput.url && openLightbox(selectedOutput.url)
    "
    @click="mobile && selectedOutput.url && openLightbox(selectedOutput.url)"
  />
  <LatentPreview v-else-if="showSkeleton || isWorkflowActive" />
  <LinearArrange v-else-if="isArrangeMode" />
  <LinearWelcome v-else />
  <div
    v-if="!mobile"
    class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center"
  >
    <LinearFeedback
      v-if="typeformWidgetId"
      side="left"
      :widget-id="typeformWidgetId"
    />
    <OutputHistory
      v-if="!isBuilderMode"
      class="z-10 min-w-0"
      @update-selection="handleSelection"
      @open-lightbox="openLightbox"
    />
    <LinearFeedback
      v-if="typeformWidgetId"
      side="right"
      :widget-id="typeformWidgetId"
    />
  </div>
  <OutputHistory
    v-else-if="!isBuilderMode"
    @update-selection="handleSelection"
    @open-lightbox="openLightbox"
  />
  <ImageLightbox v-model="lightboxOpen" :src="lightboxUrl" />
</template>
