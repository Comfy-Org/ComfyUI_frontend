<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import GeneratingScreen from '@/renderer/extensions/linearMode/GeneratingScreen.vue'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LinearWelcome from '@/renderer/extensions/linearMode/LinearWelcome.vue'
import LinearArrange from '@/renderer/extensions/linearMode/LinearArrange.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import type { OutputSelection } from '@/renderer/extensions/linearMode/linearModeTypes'
import { app } from '@/scripts/app'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const mediaActions = useMediaAssetActions()
const { isBuilderMode, isArrangeMode } = useAppMode()
const { allOutputs, isWorkflowActive, cancelActiveWorkflowJobs } =
  useOutputHistory()
const linearOutputStore = useLinearOutputStore()
const { mobile } = defineProps<{
  mobile?: boolean
}>()

const isBrowsingHistory = computed(
  () =>
    !linearOutputStore.isFollowing &&
    (linearOutputStore.selectedId?.startsWith('history:') ?? false)
)

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)
const latentPreview = ref<string>()

function handleSelection(sel: OutputSelection) {
  selectedItem.value = sel.asset
  selectedOutput.value = sel.output
  canShowPreview.value = sel.canShowPreview
  latentPreview.value = sel.latentPreviewUrl
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
</script>
<template>
  <section
    data-testid="linear-output-info"
    class="flex w-full justify-end gap-2 p-4 md:z-10"
  >
    <Popover
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
    >
      <template #button>
        <Button
          v-tooltip.top="t('g.moreOptions')"
          variant="base"
          size="icon"
          :disabled="!selectedItem"
          :aria-label="t('g.moreOptions')"
        >
          <i class="icon-[lucide--ellipsis]" />
        </Button>
      </template>
    </Popover>
    <Button
      v-tooltip.top="t('linearMode.reuseParameters')"
      variant="base"
      size="icon"
      :disabled="!selectedItem"
      :aria-label="t('linearMode.reuseParameters')"
      @click="
        () =>
          loadWorkflow(selectedItem).catch(useErrorHandling().toastErrorHandler)
      "
    >
      <i class="icon-[lucide--list-restart]" />
    </Button>
    <Button
      v-tooltip.top="t('actionbar.shareTooltip')"
      variant="base"
      size="icon"
      class="border border-solid border-border-default"
      :aria-label="t('actionbar.shareTooltip')"
      @click="
        () => openShareDialog().catch(useErrorHandling().toastErrorHandler)
      "
      @pointerenter="prefetchShareDialog"
    >
      <i class="icon-[comfy--send]" />
    </Button>
    <Button
      v-tooltip.top="t('g.download')"
      variant="inverted"
      size="icon"
      :disabled="!selectedOutput?.url"
      :aria-label="t('g.download')"
      @click="
        () => {
          if (selectedOutput?.url) downloadFile(selectedOutput.url)
        }
      "
    >
      <i class="icon-[lucide--download]" />
    </Button>
  </section>
  <GeneratingScreen
    v-if="isWorkflowActive && !isBrowsingHistory"
    @stop="cancelActiveWorkflowJobs()"
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
  />
  <LinearArrange v-else-if="isArrangeMode" />
  <LinearWelcome v-else />
  <OutputHistory
    v-if="!isBuilderMode"
    :class="cn(!mobile && 'z-10 min-w-0')"
    @update-selection="handleSelection"
  />
</template>
