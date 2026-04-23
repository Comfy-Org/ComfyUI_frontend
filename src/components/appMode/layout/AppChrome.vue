<script setup lang="ts">
/**
 * AppChrome — the chrome rail (mode toggle, feedback, run cluster, share,
 * action cells, history thumbs) shared by App Mode and App Builder.
 *
 * Architecture: three flex zones pinned to the viewport corners. Each
 * zone lays its cells out with fixed gutters using the layout tokens —
 * `calc(span * --spacing-layout-cell + (span - 1) * --spacing-layout-gutter)`
 * for width, so every cell aligns to the same grid math FloatingPanel
 * uses (`--panel-dock-width` is composed from the same tokens). No
 * distributed-gap CSS Grid — a cell in any zone and the dock panel snap
 * to identical pixel positions at every viewport.
 *
 * Zones:
 * - `top-left`  — mode toggle, builder icon, optional action cells,
 *                 optional history thumbs. Pinned to top-left outer margin.
 * - `top-right` — share, batch count, job queue, run cluster. Right edge
 *                 is flush with the dock panel's right edge, so the
 *                 cluster's left edge lines up with the panel's left.
 * - `bottom-left` — feedback.
 *
 * Variant behavior: both variants emit the same cell logic. The
 * `HIDE_IN_BUILDER` set drops contextually-wrong cells (mode toggle,
 * builder icon) and `DISABLE_IN_BUILDER` tags cells that render but are
 * inert (Run, BatchCount — you can't execute a workflow from the
 * builder). Adding a new chrome cell in App Mode automatically surfaces
 * in the builder too; keep them in sync by construction.
 */
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountCell from './cells/BatchCountCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import IconCell from './cells/IconCell.vue'
import JobQueueCell from './cells/JobQueueCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import OutputThumbCell from './cells/OutputThumbCell.vue'
import RunCell from './cells/RunCell.vue'

import { downloadFile } from '@/base/common/downloadUtil'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'

type ChromeCellKind =
  | 'system-mode-toggle'
  | 'system-builder'
  | 'system-share'
  | 'system-feedback'
  | 'system-batch-count'
  | 'system-job-queue'
  | 'system-run'
  | 'action-rerun'
  | 'action-reuse-params'
  | 'action-download'
  | 'action-info'
  | 'output-thumb'

interface ChromeCell {
  id: string
  kind: ChromeCellKind
  /** Cell count this item spans horizontally. Width =
   *  span × cell + (span - 1) × gutter. */
  span: number
  /** Visual inert state — used by the builder variant to tag cells that
   *  render identically to App Mode but can't be interacted with. */
  disabled?: boolean
}

export type AppChromeVariant = 'app-mode' | 'builder'

const { variant = 'app-mode' } = defineProps<{
  variant?: AppChromeVariant
}>()

const { t } = useI18n()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = appModeStore
const { hasNodes } = storeToRefs(appModeStore)
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

const queueStore = useQueueStore()
const { activeJobsCount } = storeToRefs(queueStore)
const showJobQueue = computed(() => activeJobsCount.value > 0)

function openShare() {
  openShareDialog().catch(toastErrorHandler)
}

// --- Output history (thumbnails + action-cell selection) ----------------
// Must be called once per mount. `fetchMediaList()` runs as a side effect
// so don't invoke this inside a computed.
const outputHistory = useOutputHistory()
const { outputs, allOutputs } = outputHistory

const linearOutputStore = useLinearOutputStore()
const { selectedId } = storeToRefs(linearOutputStore)

const selectedHistory = computed<{
  asset: AssetItem
  output: ResultItemImpl
} | null>(() => {
  const id = selectedId.value
  if (!id || !id.startsWith('history:')) return null
  const afterPrefix = id.substring('history:'.length)
  const lastColon = afterPrefix.lastIndexOf(':')
  if (lastColon === -1) return null
  const assetId = afterPrefix.substring(0, lastColon)
  const outputIndex = Number(afterPrefix.substring(lastColon + 1))
  if (!assetId || Number.isNaN(outputIndex)) return null
  const asset = outputs.media.value.find((a) => a.id === assetId)
  if (!asset) return null
  const output = allOutputs(asset)[outputIndex]
  if (!output) return null
  return { asset, output }
})

const hasSelection = computed(() => selectedHistory.value !== null)

async function loadSelectedWorkflow() {
  const sel = selectedHistory.value
  if (!sel) return
  const { workflow } = await extractWorkflowFromAsset(sel.asset)
  if (!workflow) return
  if (workflow.id !== app.rootGraph.id) {
    await app.loadGraphData(workflow)
    return
  }
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) {
    await app.loadGraphData(workflow)
    return
  }
  changeTracker.redoQueue = []
  await changeTracker.updateState([workflow], changeTracker.undoQueue)
}

async function actionRerun() {
  await loadSelectedWorkflow()
  try {
    await commandStore.execute('Comfy.QueuePrompt', {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    toastErrorHandler(error)
  }
}

function actionReuseParams() {
  loadSelectedWorkflow().catch(toastErrorHandler)
}

function actionDownload() {
  const url = selectedHistory.value?.output.url
  if (url) downloadFile(url)
}

const infoName = computed(() => {
  const sel = selectedHistory.value
  if (!sel) return ''
  return sel.output.display_name?.trim() || sel.output.filename || ''
})

// Track the loaded image's natural dimensions for the selected output.
const dimensions = ref<{ w: number; h: number } | null>(null)
watch(
  () => selectedHistory.value?.output.url,
  (url) => {
    dimensions.value = null
    if (!url) return
    const img = new Image()
    img.onload = () => {
      if (selectedHistory.value?.output.url !== url) return
      dimensions.value = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.onerror = () => {
      if (selectedHistory.value?.output.url !== url) return
      console.warn('[AppChrome] failed to load image for dimensions')
    }
    img.src = url
  },
  { immediate: true }
)

const infoDims = computed(() =>
  dimensions.value ? `${dimensions.value.w}x${dimensions.value.h}` : ''
)
const infoLabel = computed(() => {
  const dotIdx = infoName.value.lastIndexOf('.')
  return dotIdx >= 0 ? infoName.value.slice(dotIdx + 1).toLowerCase() : ''
})
const infoTitle = computed(() =>
  [infoDims.value, infoName.value].filter(Boolean).join(' ')
)

// --- History thumbnails ----------------------------------------------
interface HistoryThumb {
  id: string
  asset: AssetItem
  output: ResultItemImpl
}

const historyThumbs = computed<HistoryThumb[]>(() =>
  outputs.media.value.flatMap((asset) => {
    const outs = allOutputs(asset)
    if (outs.length === 0) return []
    return [{ id: `thumb-${asset.id}`, asset, output: outs[0] }]
  })
)

const historyThumbMap = computed(
  () => new Map(historyThumbs.value.map((t) => [t.id, t]))
)

// --- Variant-specific overrides -----------------------------------------
const HIDE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-mode-toggle',
  'system-builder'
])

const DISABLE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-batch-count',
  'system-run'
])

function include(out: ChromeCell[], cell: ChromeCell) {
  if (variant === 'builder' && HIDE_IN_BUILDER.has(cell.kind)) return
  if (variant === 'builder' && DISABLE_IN_BUILDER.has(cell.kind)) {
    out.push({ ...cell, disabled: true })
    return
  }
  out.push(cell)
}

// --- Zone cell lists ----------------------------------------------------
// Cap so a history-heavy workflow doesn't push thumbs past the top-right
// cluster on narrow viewports. Conservative for typical desktop widths.
const MAX_HISTORY_THUMBS = 6

const topLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'mode-toggle', kind: 'system-mode-toggle', span: 2 })
  if (enableAppBuilder.value) {
    include(out, { id: 'builder', kind: 'system-builder', span: 1 })
  }
  if (hasSelection.value) {
    include(out, { id: 'action-rerun', kind: 'action-rerun', span: 1 })
    include(out, {
      id: 'action-reuse-params',
      kind: 'action-reuse-params',
      span: 1
    })
    include(out, { id: 'action-download', kind: 'action-download', span: 1 })
    include(out, { id: 'action-info', kind: 'action-info', span: 3 })
  }
  const thumbCount = Math.min(historyThumbs.value.length, MAX_HISTORY_THUMBS)
  for (let i = 0; i < thumbCount; i++) {
    include(out, {
      id: historyThumbs.value[i].id,
      kind: 'output-thumb',
      span: 1
    })
  }
  return out
})

const topRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  if (showShare.value)
    include(out, { id: 'share', kind: 'system-share', span: 2 })
  include(out, {
    id: 'system-batch-count',
    kind: 'system-batch-count',
    span: 5
  })
  if (showJobQueue.value)
    include(out, { id: 'system-job-queue', kind: 'system-job-queue', span: 2 })
  include(out, { id: 'system-run', kind: 'system-run', span: 3 })
  return out
})

const bottomLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'feedback', kind: 'system-feedback', span: 4 })
  return out
})

// --- Helpers ------------------------------------------------------------
function cellWidth(span: number): string {
  return `calc(${span} * var(--spacing-layout-cell) + ${span - 1} * var(--spacing-layout-gutter))`
}

function cellTitle(cell: ChromeCell): string | undefined {
  if (cell.disabled) return t('linearMode.builder.runDisabledHint')
  if (cell.kind === 'action-info') return infoTitle.value
  return undefined
}
</script>

<template>
  <!-- Positioning host. absolute inset: 0 fills a positioned ancestor
       (LayoutView's .layout-view). In builder mode there's no such
       ancestor, so the variant-specific rules below switch to fixed
       positioning below the workflow tabs. -->
  <div class="app-chrome" :data-variant="variant">
    <div class="app-chrome__zone app-chrome__zone--top-left">
      <div
        v-for="cell in topLeftCells"
        :key="cell.id"
        class="app-chrome__cell"
        :class="{ 'app-chrome__cell--disabled': cell.disabled }"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-builder'"
          icon="icon-[lucide--hammer]"
          :label="t('linearMode.appModeToolbar.appBuilder')"
          :disabled="!hasNodes"
          :on-activate="enterBuilder"
        />
        <ModeToggleCell v-else-if="cell.kind === 'system-mode-toggle'" />
        <IconCell
          v-else-if="cell.kind === 'action-rerun'"
          icon="icon-[lucide--refresh-cw]"
          :label="t('linearMode.rerun')"
          :on-activate="actionRerun"
        />
        <IconCell
          v-else-if="cell.kind === 'action-reuse-params'"
          icon="icon-[lucide--list-restart]"
          :label="t('linearMode.reuseParameters')"
          :on-activate="actionReuseParams"
        />
        <IconCell
          v-else-if="cell.kind === 'action-download'"
          icon="icon-[lucide--download]"
          :label="t('g.download')"
          :on-activate="actionDownload"
        />
        <div
          v-else-if="cell.kind === 'action-info'"
          class="duration-layout flex size-full cursor-default items-center gap-2 rounded-layout-cell bg-layout-cell px-3 font-inter text-layout-md text-layout-text transition-colors ease-layout hover:bg-layout-cell-hover"
        >
          <i class="icon-[lucide--file] size-5 shrink-0" aria-hidden="true" />
          <span
            v-if="infoDims"
            class="shrink-0 text-layout-text tabular-nums"
            >{{ infoDims }}</span
          >
          <span class="min-w-0 truncate tracking-[0.02em] tabular-nums">{{
            infoLabel
          }}</span>
        </div>
        <OutputThumbCell
          v-else-if="
            cell.kind === 'output-thumb' && historyThumbMap.get(cell.id)
          "
          :asset="historyThumbMap.get(cell.id)!.asset"
          :output="historyThumbMap.get(cell.id)!.output"
        />
      </div>
    </div>

    <div class="app-chrome__zone app-chrome__zone--top-right">
      <div
        v-for="cell in topRightCells"
        :key="cell.id"
        class="app-chrome__cell"
        :class="{ 'app-chrome__cell--disabled': cell.disabled }"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-share'"
          icon="icon-[lucide--send]"
          :label="t('actionbar.share')"
          inline-label
          :on-activate="openShare"
          @pointerenter="prefetchShareDialog"
        />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <JobQueueCell v-else-if="cell.kind === 'system-job-queue'" />
        <RunCell v-else-if="cell.kind === 'system-run'" />
      </div>
    </div>

    <div class="app-chrome__zone app-chrome__zone--bottom-left">
      <div
        v-for="cell in bottomLeftCells"
        :key="cell.id"
        class="app-chrome__cell"
        :class="{ 'app-chrome__cell--disabled': cell.disabled }"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <FeedbackCell v-if="cell.kind === 'system-feedback'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Positioning host. `app-mode` variant anchors to its positioned
   LayoutView ancestor via absolute inset. `builder` variant has no
   such ancestor so it bolts to the viewport below the workflow tabs,
   under the FloatingPanel (z-index 100) and any drag preview. */
.app-chrome {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.app-chrome[data-variant='builder'] {
  position: fixed;
  top: var(--workflow-tabs-height);
  /* Offset past the Comfy sidebar icon strip so top-left zone aligns
     with BuilderMenu's left edge (which also clears the sidebar via
     --sidebar-width). */
  left: var(--sidebar-width, 0);
  right: 0;
  bottom: 0;
  z-index: 90;
  cursor: not-allowed;
}

/* Zones: flex rows pinned to a corner, fixed gutter. Each zone is a
   clean container so cells within it compose with pixel-perfect math
   — no distributed-gap side effects. */
.app-chrome__zone {
  position: absolute;
  display: flex;
  flex-direction: row;
  gap: var(--spacing-layout-gutter);
  height: var(--spacing-layout-cell);
  pointer-events: none;
}

.app-chrome__zone--top-left {
  top: var(--spacing-layout-outer);
  left: var(--spacing-layout-outer);
}

.app-chrome__zone--top-right {
  top: var(--spacing-layout-outer);
  right: var(--spacing-layout-outer);
}

.app-chrome__zone--bottom-left {
  bottom: var(--spacing-layout-outer);
  left: var(--spacing-layout-outer);
}

/* Cell chrome: hairline border + radius so every cell reads as part of
   the FloatingPanel family. Height fills the zone (single row). */
.app-chrome__cell {
  box-sizing: border-box;
  display: flex;
  height: 100%;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 10px;
  background-color: var(--color-layout-cell);
  overflow: hidden;
  pointer-events: auto;
}

/* Run cell hosts the accent button directly — drop the chrome surface
   so only the button paints and the cell radius matches the button. */
.app-chrome__cell[data-cell-kind='system-run'] {
  border: none;
  background-color: transparent;
}

/* Disabled signal for variant="builder" — dim + no-select + no-click. */
.app-chrome__cell--disabled {
  opacity: 0.55;
  user-select: none;
  cursor: not-allowed;
}
</style>
