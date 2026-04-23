<script setup lang="ts">
/**
 * AppChrome — the grid-anchored chrome (mode toggle, feedback, run cluster,
 * share, action cells, history thumbs) shared by App Mode and App Builder.
 *
 * Single source of truth: both variants emit the same cells from the
 * same logic. Variant-specific differences are declarative — the
 * `HIDE_IN_BUILDER` set drops contextually-wrong cells (mode-toggle,
 * builder icon) and `DISABLE_IN_BUILDER` tags cells that render but
 * are inert (Run, BatchCount — you can't execute a workflow from the
 * builder). Adding a new chrome cell for App Mode automatically
 * surfaces in the builder too; keep them in sync by construction.
 */
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import LayoutGrid from './LayoutGrid.vue'
import type { LayoutCellPlacement } from './LayoutGrid.vue'
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

interface ChromeCell extends LayoutCellPlacement {
  kind: ChromeCellKind
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
// Kinds the builder should never render — mode-toggle conflicts with
// BuilderFooterToolbar's exit affordance; the builder-enter icon is
// redundant when we're already in the builder.
const HIDE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-mode-toggle',
  'system-builder'
])

// Kinds the builder renders visually but keeps inert — they exist so
// the preview matches App Mode runtime, not so the user can trigger
// them from the builder.
const DISABLE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-batch-count',
  'system-run'
])

// --- Cell placements ----------------------------------------------------
// One array, built once, filtered by variant. Changes here automatically
// land in both App Mode and the builder.
const cells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  const include = (cell: ChromeCell) => {
    if (variant === 'builder' && HIDE_IN_BUILDER.has(cell.kind)) return
    if (variant === 'builder' && DISABLE_IN_BUILDER.has(cell.kind)) {
      out.push({ ...cell, disabled: true })
      return
    }
    out.push(cell)
  }

  // Row 1, left side (left-to-right): mode toggle, then optional builder.
  // Toggle anchors at col 1 so it doesn't shift when builder visibility
  // changes. Share sits in the right-side group, mirroring the graph-view
  // top-right composition.
  include({
    id: 'mode-toggle',
    col: 1,
    row: 1,
    colSpan: 2,
    kind: 'system-mode-toggle'
  })
  let col = 3
  if (enableAppBuilder.value) {
    include({ id: 'builder', col: col++, row: 1, kind: 'system-builder' })
  }

  // Action cells (right of the builder icon), only when a history item
  // is selected. Mirrors LinearPreview's top bar.
  if (hasSelection.value) {
    include({ id: 'action-rerun', col: col++, row: 1, kind: 'action-rerun' })
    include({
      id: 'action-reuse-params',
      col: col++,
      row: 1,
      kind: 'action-reuse-params'
    })
    include({
      id: 'action-download',
      col: col++,
      row: 1,
      kind: 'action-download'
    })
    include({
      id: 'action-info',
      col,
      row: 1,
      colSpan: 3,
      kind: 'action-info'
    })
    col += 3
  }

  include({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 4,
    kind: 'system-feedback'
  })

  // Row 1, right side (right-to-left): Run → BatchCount → JobQueue
  // (when active) → Share. Negative col + span anchors to the right
  // edge via CSS Grid's end-aligned line numbers (line -1 = N+1).
  include({
    id: 'system-run',
    col: -4,
    colSpan: 3,
    row: 1,
    kind: 'system-run'
  })
  if (showJobQueue.value) {
    include({
      id: 'system-job-queue',
      col: -6,
      colSpan: 2,
      row: 1,
      kind: 'system-job-queue'
    })
  }
  const batchShift = showJobQueue.value ? -2 : 0
  include({
    id: 'system-batch-count',
    col: -9 + batchShift,
    colSpan: 5,
    row: 1,
    kind: 'system-batch-count'
  })
  if (showShare.value) {
    include({
      id: 'share',
      col: -11 + batchShift,
      colSpan: 2,
      row: 1,
      kind: 'system-share'
    })
  }

  // History thumbs on row 1, right of the action cells. Capped so positive
  // indices don't overflow into the right cluster's negative-indexed
  // resolved positions on narrow viewports.
  const MAX_HISTORY_THUMBS = 6
  const thumbCount = Math.min(historyThumbs.value.length, MAX_HISTORY_THUMBS)
  for (let i = 0; i < thumbCount; i++) {
    include({
      id: historyThumbs.value[i].id,
      col: col + i,
      row: 1,
      kind: 'output-thumb'
    })
  }

  return out
})

// Fast lookup for the template to tag a given cell's slot as disabled.
const disabledIds = computed(
  () => new Set(cells.value.filter((c) => c.disabled).map((c) => c.id))
)
</script>

<template>
  <!-- Positioning host. absolute inset: 0 fills a positioned ancestor
       (LayoutView's .layout-view). In builder mode there's no such
       ancestor, so the variant-specific rules below switch to fixed
       positioning below the workflow tabs. -->
  <div class="app-chrome" :data-variant="variant">
    <LayoutGrid :cells="cells">
      <template v-for="cell in cells" :key="cell.id" #[cell.id]>
        <!-- `inert` removes disabled cells from focus/event path so their
             content looks like App Mode but can't be tab-targeted or clicked.
             Opacity + cursor come from CSS below. -->
        <div
          class="app-chrome__cell"
          :class="{ 'app-chrome__cell--disabled': disabledIds.has(cell.id) }"
          :inert="disabledIds.has(cell.id) || undefined"
          :title="
            disabledIds.has(cell.id)
              ? t('linearMode.builder.runDisabledHint')
              : undefined
          "
        >
          <IconCell
            v-if="cell.kind === 'system-builder'"
            icon="icon-[lucide--hammer]"
            :label="t('linearMode.appModeToolbar.appBuilder')"
            :disabled="!hasNodes"
            :on-activate="enterBuilder"
          />
          <IconCell
            v-else-if="cell.kind === 'system-share'"
            icon="icon-[lucide--send]"
            :label="t('actionbar.share')"
            inline-label
            :on-activate="openShare"
            @pointerenter="prefetchShareDialog"
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
            :title="infoTitle"
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
          <FeedbackCell v-else-if="cell.kind === 'system-feedback'" />
          <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
          <JobQueueCell v-else-if="cell.kind === 'system-job-queue'" />
          <RunCell v-else-if="cell.kind === 'system-run'" />
          <OutputThumbCell
            v-else-if="
              cell.kind === 'output-thumb' && historyThumbMap.get(cell.id)
            "
            :asset="historyThumbMap.get(cell.id)!.asset"
            :output="historyThumbMap.get(cell.id)!.output"
          />
        </div>
      </template>
    </LayoutGrid>
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
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  cursor: not-allowed;
}

/* Grid is a transparent overlay; empty areas pass pointer events through
   to whatever's behind (LinearPreview for App Mode, the graph canvas
   for the builder). */
.app-chrome :deep(.layout-grid) {
  background-color: transparent;
  pointer-events: none;
}
.app-chrome :deep(.layout-grid) > * {
  pointer-events: auto;
}

/* Cell chrome: hairline border + radius so every cell reads as part of
   the FloatingPanel family. Applied via the data-cell-kind attribute so
   only real (non-ghost) cells pick it up. */
.app-chrome :deep(.layout-cell[data-cell-kind='system-mode-toggle']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-builder']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-share']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-feedback']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-batch-count']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-job-queue']),
.app-chrome :deep(.layout-cell[data-cell-kind='system-run']),
.app-chrome :deep(.layout-cell[data-cell-kind='action-rerun']),
.app-chrome :deep(.layout-cell[data-cell-kind='action-reuse-params']),
.app-chrome :deep(.layout-cell[data-cell-kind='action-download']),
.app-chrome :deep(.layout-cell[data-cell-kind='action-info']),
.app-chrome :deep(.layout-cell[data-cell-kind='output-thumb']) {
  box-sizing: border-box;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 10px;
  overflow: hidden;
}

/* Run cell hosts the accent button directly — drop the chrome fill so
   only the button paints and the cell radius matches the button. */
.app-chrome :deep(.layout-cell[data-cell-kind='system-run']) {
  border: none;
  background-color: transparent;
}

/* Cells get a wrapper div (.app-chrome__cell) so we can stamp inert on
   disabled ones without losing sizing. Normally `display: contents` keeps
   the wrapper out of layout so cell backgrounds/borders apply exactly
   as before. Disabled variant becomes a real flex box so opacity (which
   needs a generated stacking context) can render. */
.app-chrome__cell {
  display: contents;
}

/* Disabled signal for variant="builder". The real box is required so
   opacity + title tooltip have a surface to attach to. Fills the cell. */
.app-chrome__cell--disabled {
  display: flex;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
  user-select: none;
  cursor: not-allowed;
}
</style>
