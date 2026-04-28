<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useExecutionStore } from '@/stores/executionStore'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import OutputWindowList from '@/components/appMode/layout/OutputWindowList.vue'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import LinearWelcome from '@/renderer/extensions/linearMode/LinearWelcome.vue'
import LinearArrange from '@/renderer/extensions/linearMode/LinearArrange.vue'
import LinearFeedback from '@/renderer/extensions/linearMode/LinearFeedback.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import OutputHistory from '@/renderer/extensions/linearMode/OutputHistory.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useOutputWindowSync } from '@/renderer/extensions/linearMode/useOutputWindowSync'
import type { OutputSelection } from '@/renderer/extensions/linearMode/linearModeTypes'
import { app } from '@/scripts/app'
import type { ResultItemImpl } from '@/stores/queueStore'

const { t } = useI18n()
const mediaActions = useMediaAssetActions()
const { isBuilderMode, isArrangeMode } = useAppMode()
const executionStore = useExecutionStore()

// Bridges linearOutputStore's in-progress lifecycle into windowStore.
useOutputWindowSync()
const windowStore = useOutputWindowStore()

// Read the active node's step ratio directly. Graph-level fallback
// (completed/total nodes) over-credits encoders and bounces the bar
// when the sampler starts; 0 outside sampler reads better.
const progressPercent = computed(() => {
  const p = executionStore._executingNodeProgress
  if (p && p.max > 0) {
    return Math.max(0, Math.min(100, (p.value / p.max) * 100))
  }
  return 0
})

// Per-node step + ETA (tqdm-style). Resets on (job, node) change so
// linear extrapolation doesn't average across encoder + sampler.
const stepProgress = ref<{ value: number; max: number } | null>(null)
const etaSeconds = ref<number | null>(null)
let samplingStart: { ts: number; firstValue: number; key: string } | null = null
watch(
  () => executionStore._executingNodeProgress,
  (p) => {
    if (!p || p.max <= 0) {
      stepProgress.value = null
      etaSeconds.value = null
      samplingStart = null
      return
    }
    stepProgress.value = { value: p.value, max: p.max }
    const key = `${p.prompt_id}::${p.node}`
    if (!samplingStart || samplingStart.key !== key) {
      samplingStart = { ts: Date.now(), firstValue: p.value, key }
      etaSeconds.value = null
      return
    }
    const stepsDone = p.value - samplingStart.firstValue
    if (stepsDone <= 0) return
    const msPerStep = (Date.now() - samplingStart.ts) / stepsDone
    const remaining = p.max - p.value
    etaSeconds.value = Math.max(0, Math.round((remaining * msPerStep) / 1000))
  }
)
function formatEta(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}
const { allOutputs, isWorkflowActive, cancelActiveWorkflowJobs } =
  useOutputHistory()
const { runButtonClick, mobile, typeformWidgetId, hideChrome } = defineProps<{
  runButtonClick?: (e: Event) => void
  mobile?: boolean
  typeformWidgetId?: string
  /** App Mode renders its own history + action chrome; suppresses
   *  the standalone top bar + bottom history/feedback strip. */
  hideChrome?: boolean
}>()

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)
const latentPreview = ref<string>()
const showSkeleton = ref(false)

// `isWorkflowActive` covers the Run-click → first-skeleton gap so
// the welcome doesn't flash back on.
const hasMoodboardContent = computed(
  () => windowStore.windows.length > 0 || isWorkflowActive.value
)

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
  // Same id — update in-place, push old version onto undo.
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
  <!-- App Mode (hideChrome): one OutputWindow per generation;
       welcome / arrange fill the canvas while empty. -->
  <template v-if="hideChrome">
    <OutputWindowList
      :progress-percent="progressPercent"
      :step-progress="stepProgress"
      :eta-seconds="etaSeconds"
      :format-eta="formatEta"
    />
    <LinearArrange v-if="isArrangeMode && !hasMoodboardContent" />
    <LinearWelcome v-else-if="!hasMoodboardContent" />
  </template>
  <Transition v-else name="preview-fade">
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
  <!-- Standalone linear mode only; App Mode uses useOutputWindowSync. -->
  <div
    v-if="!hideChrome && !mobile"
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
    v-else-if="!hideChrome && !isBuilderMode"
    @update-selection="handleSelection"
  />
</template>

<!-- Unscoped: <Transition> classes apply to slot-child roots, which
     scoped styles can't reach without :deep(). -->
<style>
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 250ms ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
/* Pin the outgoing element so the incoming one fades in without a
   layout collapse. */
.preview-fade-leave-active {
  position: absolute;
  inset: 0;
}
</style>
