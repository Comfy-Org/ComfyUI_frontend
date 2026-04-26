<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { isCloud } from '@/platform/distribution/types'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import OutputWindow from '@/components/appMode/layout/OutputWindow.vue'
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
import { ResultItemImpl } from '@/stores/queueStore'
import { resolveNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const mediaActions = useMediaAssetActions()
const { isBuilderMode, isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()
const executionStore = useExecutionStore()

// Blended progress: completed-node count + the executing node's
// internal step progress, so the bar moves during long single-node
// phases (KSampler etc.) instead of freezing between node events.
const progressPercent = computed(() => {
  const total = executionStore.totalNodesToExecute
  if (total <= 0) return 0
  const completed = executionStore.nodesExecuted ?? 0
  const inFlight = executionStore.executingNodeProgress ?? 0
  return Math.max(0, Math.min(100, ((completed + inFlight) / total) * 100))
})

// Per-node step + ETA, mirroring tqdm's "12/30 [00:08<00:14]" line in
// the ComfyUI server log. The terminal output is the user's only other
// signal that long sampling phases are progressing; surfacing the same
// numbers in-app removes the need to keep that terminal in view.
//
// ETA derives from elapsed-since-tracking-started divided by steps
// completed in that same window — linear extrapolation, matching how
// tqdm reports its "Xs remaining" estimate. The tracker resets on
// every (job, node) change so it doesn't average across a fast text-
// encoder pass and the slow sampler that follows.
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

// True whenever the OutputWindow should be mounted. Two bridge
// signals book-end the active phase to keep the window from
// flashing on/off around the queue/linear store transitions:
//   `runPending`   — covers Run-click → isWorkflowActive=true
//   `gracePeriod`  — covers isWorkflowActive=false → selectedOutput set
// Without grace the window unmounts the moment the run ends, then
// remounts when the OutputHistory event lands a beat later.
const { runPending } = storeToRefs(appModeStore)
const gracePeriod = ref(false)
let graceTimer: ReturnType<typeof setTimeout> | null = null
const hasOutputContent = computed(
  () =>
    runPending.value ||
    isWorkflowActive.value ||
    gracePeriod.value ||
    !!(canShowPreview.value && latentPreview.value) ||
    !!selectedOutput.value ||
    showSkeleton.value
)
watch(isWorkflowActive, (active) => {
  if (active) {
    appModeStore.clearRunPending()
    gracePeriod.value = false
    if (graceTimer) {
      clearTimeout(graceTimer)
      graceTimer = null
    }
  } else {
    gracePeriod.value = true
    if (graceTimer) clearTimeout(graceTimer)
    graceTimer = setTimeout(() => {
      gracePeriod.value = false
      graceTimer = null
    }, 2000)
  }
})

// Window title derives from the source output node's title — same
// label graph view shows on the node ("Save Image" / "Save Video" /
// any user-renamed node). When no run has happened yet, fall back to
// the i18n default. Re-reads on selectedOutput change; node-title
// edits made while the window is open won't reflect until the next
// selection swap, which is fine for now.
const windowTitle = computed(() => {
  const out = selectedOutput.value
  if (!out) return undefined
  const node = resolveNode(out.nodeId)
  return node?.title || undefined
})

const windowFilename = computed(() => {
  const out = selectedOutput.value
  if (!out) return undefined
  return out.display_name?.trim() || out.filename || undefined
})

// In Cloud mode the file is stored under `asset.asset_hash`, not the
// user-facing filename — the original `output.url` builds
// `/view?filename=<original>` which 404s. Re-clone the ResultItem
// with the hash as the filename param so the URL resolves; keep
// display_name etc. for the user-facing label. OSS mode passes
// through unchanged.
const resolvedOutput = computed<ResultItemImpl | undefined>(() => {
  const out = selectedOutput.value
  if (!out) return undefined
  if (!isCloud) return out
  const hash = selectedItem.value?.asset_hash
  if (!hash) return out
  return new ResultItemImpl({
    filename: hash,
    subfolder: out.subfolder,
    // ResultItemImpl widens type to string; the zod schema and the
    // init interface keep it as the narrow union, so cast back.
    type: out.type as 'input' | 'output' | 'temp' | undefined,
    nodeId: out.nodeId,
    mediaType: out.mediaType,
    format: out.format,
    frame_rate: out.frame_rate,
    display_name: out.display_name,
    content: out.content
  })
})

// Header ellipsis menu — multi-image bulk actions + delete. Single-
// image runs only get delete; the bulk download item drops out at
// length === 1 to avoid the redundant single-item entry.
const windowMenuEntries = computed<MenuItem[]>(() => {
  const item = selectedItem.value
  if (!item) return []
  const all = allOutputs(item)
  const entries: MenuItem[] = []
  if (all.length > 1) {
    entries.push({
      icon: 'icon-[lucide--download]',
      label: t('linearMode.downloadAll', { count: all.length }),
      command: () => downloadAsset(item)
    })
    entries.push({ separator: true })
  }
  entries.push({
    icon: 'icon-[lucide--trash-2]',
    label: t('linearMode.deleteAllAssets'),
    command: () => mediaActions.deleteAssets(item)
  })
  return entries
})

// Hover-toolbar handlers. These mirror AppChrome's actionRerun /
// actionDownload (App Mode does NOT pass `runButtonClick`, so the
// existing `rerun()` function above is a no-op in App Mode) and
// dispatch the command directly via commandStore.
async function windowRerun() {
  const item = selectedItem.value
  if (!item) return
  await loadWorkflow(item)
  appModeStore.markRunPending()
  try {
    await commandStore.execute('Comfy.QueuePrompt', {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    appModeStore.clearRunPending()
    toastErrorHandler(error)
  }
}

function windowDownload() {
  const url = selectedOutput.value?.url
  if (url) downloadFile(url)
}

async function windowInterrupt() {
  try {
    await commandStore.execute('Comfy.Interrupt')
  } catch (error) {
    toastErrorHandler(error)
  }
}

// Graph-view image-node toolbar styling: light pill on dark icon so
// the toolbar reads against any image content. Matches
// vueNodes/components/ImagePreview.vue's actionButtonClass.
const BODY_ACTION_CLASS =
  'flex h-8 min-h-8 cursor-pointer items-center justify-center ' +
  'rounded-lg border-0 bg-base-foreground p-2 text-base-background ' +
  'shadow-interface transition-colors duration-200 ' +
  'hover:bg-base-foreground/90 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-base-foreground ' +
  'focus-visible:ring-offset-2'

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
    App Mode (hideChrome): output content (skeleton / latent / final)
    renders inside a movable OutputWindow card, so the run→image
    beat happens inside a stable spatial frame instead of swapping
    a full-viewport layer. Welcome / arrange states stay full-
    viewport in the workspace behind the window. Standalone linear-
    mode (the original chromeful path) keeps the prior behavior.
  -->
  <template v-if="hideChrome">
    <OutputWindow
      v-if="hasOutputContent"
      :title="windowTitle"
      :filename="windowFilename"
      :menu-entries="windowMenuEntries"
    >
      <template #body-actions>
        <button
          v-if="selectedItem"
          type="button"
          :class="BODY_ACTION_CLASS"
          :title="t('linearMode.rerun')"
          :aria-label="t('linearMode.rerun')"
          @click="windowRerun"
        >
          <i class="icon-[lucide--refresh-cw] size-4" />
        </button>
        <button
          v-if="selectedItem"
          type="button"
          :class="BODY_ACTION_CLASS"
          :title="t('linearMode.reuseParameters')"
          :aria-label="t('linearMode.reuseParameters')"
          @click="() => loadWorkflow(selectedItem)"
        >
          <i class="icon-[lucide--list-restart] size-4" />
        </button>
        <button
          v-if="selectedOutput"
          type="button"
          :class="BODY_ACTION_CLASS"
          :title="t('g.download')"
          :aria-label="t('g.download')"
          @click="windowDownload"
        >
          <i class="icon-[lucide--download] size-4" />
        </button>
      </template>
      <!-- size-full overrides ImagePreview's flex-1 sizing so the
           media fills the OutputWindow body without depending on the
           parent flex context (which `contain: size` on the
           ImagePreview wrapper interacts with unpredictably). -->
      <Transition name="preview-fade">
        <ImagePreview
          v-if="canShowPreview && latentPreview"
          key="latent"
          class="size-full"
          :mobile
          :src="latentPreview"
          :show-size="false"
        />
        <MediaOutputPreview
          v-else-if="resolvedOutput"
          key="final"
          class="size-full"
          :output="resolvedOutput"
          :mobile
          :hide-info="hideChrome"
        />
        <LatentPreview
          v-else-if="
            showSkeleton || isWorkflowActive || runPending || gracePeriod
          "
          key="skeleton"
          class="size-full"
        />
      </Transition>
      <!-- Run-status overlay (centered): progress bar + stop button.
           Active-state UI lives on the image itself, where the user
           is already looking, instead of in chrome cells that flash
           on/off in the corner of the canvas. -->
      <template #body-overlay>
        <div
          v-if="isWorkflowActive"
          class="pointer-events-auto flex w-72 flex-col items-stretch gap-3 rounded-xl bg-black/65 p-4 shadow-2xl backdrop-blur-md"
          data-testid="output-window-run-status"
        >
          <div
            class="h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            :aria-label="t('linearMode.runProgress')"
            :aria-valuenow="progressPercent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full bg-(--app-mode-go-bg-hover) transition-[width] duration-300 ease-out"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <!-- Step counter + ETA. Hides when no node is reporting
               progress (between nodes / cold model load) so we don't
               render a stale "step 30/30" from the prior node. ETA
               line is rendered separately so step counter stays as
               soon as the first progress event lands. -->
          <div
            v-if="stepProgress"
            class="flex items-baseline justify-between gap-3 text-xs text-white/85 tabular-nums"
          >
            <span>{{
              t('linearMode.outputs.step', {
                value: stepProgress.value,
                max: stepProgress.max
              })
            }}</span>
            <span v-if="etaSeconds !== null">{{
              t('linearMode.outputs.etaRemaining', {
                eta: formatEta(etaSeconds)
              })
            }}</span>
          </div>
          <button
            type="button"
            :class="[
              'flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg',
              'border border-(--app-mode-stop-border) bg-(--app-mode-stop-bg) text-white',
              'transition-colors duration-200 hover:bg-(--app-mode-stop-bg-hover)'
            ]"
            :title="t('linearMode.stop')"
            :aria-label="t('linearMode.stop')"
            data-testid="output-window-cancel-run"
            @click="windowInterrupt"
          >
            <i class="icon-[lucide--x] size-4" />
            {{ t('linearMode.stop') }}
          </button>
        </div>
      </template>
    </OutputWindow>
    <LinearArrange v-else-if="isArrangeMode" />
    <LinearWelcome v-else />
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
