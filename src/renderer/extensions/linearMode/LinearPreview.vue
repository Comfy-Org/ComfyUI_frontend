<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
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
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import type { OutputSelection } from '@/renderer/extensions/linearMode/linearModeTypes'
import { app } from '@/scripts/app'
import type { ResultItemImpl } from '@/stores/queueStore'

const { t } = useI18n()
const mediaActions = useMediaAssetActions()
const { isBuilderMode, isArrangeMode } = useAppMode()
const { allOutputs, isWorkflowActive, cancelActiveWorkflowJobs } =
  useOutputHistory()
const { runButtonClick, mobile, typeformWidgetId, hideChrome } = defineProps<{
  runButtonClick?: (e: Event) => void
  mobile?: boolean
  typeformWidgetId?: string
  /** App Mode layout renders its own history + action chrome in the grid;
   *  this suppresses both LinearPreview's top action bar and the bottom
   *  history/feedback strip so we don't double up. */
  hideChrome?: boolean
}>()

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)
const latentPreview = ref<string>()
const showSkeleton = ref(false)

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
    v-if="
      !hideChrome &&
      (selectedItem || selectedOutput || showSkeleton || isWorkflowActive)
    "
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
      data-testid="linear-cancel-run"
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
  <!--
    Crossfade between preview states — the "image arrives" beat for
    a run. `mode="default"` (the omitted default) lets the outgoing
    element overlap the incoming one, and the `.preview-fade-leave-
    active` rule pins the leaving element to the workspace bounds so
    it holds its position while the new one fades in underneath. The
    workspace is `position: absolute; inset: 0`, so the pinning
    keeps the full preview area covered during the ~250ms swap.
  -->
  <Transition name="preview-fade">
    <ImagePreview
      v-if="canShowPreview && latentPreview"
      key="latent"
      :mobile
      :src="latentPreview"
      :show-size="false"
    />
    <MediaOutputPreview
      v-else-if="selectedOutput"
      key="final"
      :output="selectedOutput"
      :mobile
      :hide-info="hideChrome"
    />
    <LatentPreview
      v-else-if="showSkeleton || isWorkflowActive"
      key="skeleton"
    />
    <LinearArrange v-else-if="isArrangeMode" key="arrange" />
    <LinearWelcome v-else key="welcome" />
  </Transition>
  <!-- The inner OutputHistory must stay mounted even when the layout
       layout hides this bar — its watchers drive selectedItem /
       selectedOutput via `updateSelection`. v-show keeps the DOM +
       watchers alive; display:none just hides it visually. -->
  <div
    v-if="!mobile"
    v-show="!hideChrome"
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
    />
    <LinearFeedback
      v-if="typeformWidgetId"
      side="right"
      :widget-id="typeformWidgetId"
    />
  </div>
  <OutputHistory
    v-else-if="!isBuilderMode"
    v-show="!hideChrome"
    @update-selection="handleSelection"
  />
</template>

<!--
  Unscoped because Vue's `<Transition>` applies these classes to the
  root element of whichever child component is currently mounted
  (ImagePreview, MediaOutputPreview, etc.). Scoped styles wouldn't
  reach those roots without `:deep()`, and the hashed selector would
  add noise for no isolation benefit — `preview-fade-*` is unique to
  this component's Transition.
-->
<style>
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 250ms ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
/* Pin the outgoing element to the workspace bounds during its fade
   so the incoming element can fade in underneath without a layout
   collapse. The workspace (`.layout-view__background`) is
   position:absolute inset:0, so the leaving element inherits a
   stable full-viewport containing block. */
.preview-fade-leave-active {
  position: absolute;
  inset: 0;
}
</style>
