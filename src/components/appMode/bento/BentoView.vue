<script setup lang="ts">
/**
 * BentoView — App Mode runtime view rebuilt around the bento grid.
 *
 * Prototype scope: hard-coded cell layout matching design/mockups/grid-system-001.png.
 * System-pinned cells port the existing AppModeToolbar functionality:
 *   - Mode toggle (App ↔ Graph dropdown)
 *   - Builder (hammer)
 *   - Share (cloud + sharing-flag only)
 *   - Assets (sidebar tab toggle)
 *   - Apps (sidebar tab toggle)
 *   - Help (placeholder)
 *   - Run (placeholder)
 *
 * Stub input/output cells are visible boxes for now; real widget/output
 * rendering swaps in next.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import BentoGrid from './BentoGrid.vue'
import type { BentoCellPlacement } from './BentoGrid.vue'
import IconCell from './cells/IconCell.vue'
import RunCell from './cells/RunCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import InputsCell from './cells/InputsCell.vue'
import OutputsCell from './cells/OutputsCell.vue'
import BatchCountCell from './cells/BatchCountCell.vue'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'

const { t } = useI18n()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = appModeStore
const { hasNodes } = storeToRefs(appModeStore)
const commandStore = useCommandStore()
const workspaceStore = useWorkspaceStore()
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()

const isAssetsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'assets'
)
const isAppsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'apps'
)

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

function openAssets() {
  void commandStore.execute('Workspace.ToggleSidebarTab.assets')
}
function showApps() {
  void commandStore.execute('Workspace.ToggleSidebarTab.apps')
}
function openShare() {
  openShareDialog().catch(toastErrorHandler)
}

// Layout matches design/mockups/grid-system-001.png:
// - Col 1 holds a vertical stack of utility icon cells
// - Col 2-3 row 1 hosts the App↔Graph mode toggle
// - Col 1 row 8 is the Help cell
// - Col 11-12 row 8 is the Run cell
// - Stub input/output cells fill the remaining space for visual demo
const cells = computed<BentoCellPlacement[]>(() => {
  const out: BentoCellPlacement[] = []

  // System-pinned utility column (col 1)
  let row = 1
  if (enableAppBuilder.value) {
    out.push({ id: 'builder', col: 1, row: row++, kind: 'system-builder' })
  }
  if (showShare.value) {
    out.push({ id: 'share', col: 1, row: row++, kind: 'system-share' })
  }
  out.push({ id: 'assets', col: 1, row: row++, kind: 'system-assets' })
  out.push({ id: 'apps', col: 1, row: row++, kind: 'system-apps' })

  // Mode toggle (col 2-3, row 1)
  out.push({
    id: 'mode-toggle',
    col: 2,
    row: 1,
    colSpan: 2,
    kind: 'system-mode-toggle'
  })

  // Feedback (bottom-left) — 3 cols wide so the "App mode in beta /
  // Give feedback" text fits next to the Typeform button.
  // row: -2 anchors to last row regardless of grid size.
  out.push({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 3,
    kind: 'system-feedback'
  })

  // Run (bottom-right) — 5 cols wide so the label has room to breathe.
  out.push({ id: 'run', col: -6, row: -2, colSpan: 5, kind: 'system-run' })

  // Batch count (one row above Run, same column span). First label/
  // widget pair broken into its own bento cell — pilots Phase 2.
  out.push({
    id: 'batch-count',
    col: -6,
    row: -3,
    colSpan: 5,
    kind: 'system-batch-count'
  })

  // Phase 1 default layout: single hero output cell on the left,
  // single inputs column cell on the right. Stretched large so both
  // breathe. These are container cells that host the existing
  // LinearPreview / AppModeWidgetList components for now.
  //
  // Col indices assume a typical ~20-col grid at desktop width. At
  // narrower viewports the grid has fewer columns and these cells
  // still occupy most of the available space via negative-index
  // right anchoring.
  //
  // Outputs hero: col 4 .. col -8 (stops 7 cols before right edge),
  //               rows 1 .. -3 (stops before the bottom system row)
  out.push({
    id: 'outputs',
    col: 4,
    row: 1,
    colSpan: 14,
    rowSpan: 10,
    kind: 'outputs'
  })
  // Inputs column: 6 cols wide on the right, stops before Run row
  out.push({
    id: 'inputs',
    col: -7,
    row: 1,
    colSpan: 6,
    rowSpan: 10,
    kind: 'inputs'
  })

  return out
})
</script>

<template>
  <div class="bento-view">
    <BentoGrid :cells="cells" fill-empty>
      <template v-for="cell in cells" :key="cell.id" #[cell.id]>
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
          :label="t('actionbar.shareTooltip')"
          :on-activate="openShare"
          @pointerenter="prefetchShareDialog"
        />
        <IconCell
          v-else-if="cell.kind === 'system-assets'"
          icon="icon-[comfy--image-ai-edit]"
          :label="t('sideToolbar.mediaAssets.title')"
          :active="isAssetsActive"
          :on-activate="openAssets"
        />
        <IconCell
          v-else-if="cell.kind === 'system-apps'"
          icon="icon-[lucide--panels-top-left]"
          :label="t('linearMode.appModeToolbar.apps')"
          :active="isAppsActive"
          :on-activate="showApps"
        />
        <ModeToggleCell v-else-if="cell.kind === 'system-mode-toggle'" />
        <FeedbackCell v-else-if="cell.kind === 'system-feedback'" />
        <RunCell v-else-if="cell.kind === 'system-run'" />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <InputsCell v-else-if="cell.kind === 'inputs'" />
        <OutputsCell v-else-if="cell.kind === 'outputs'" />
        <div v-else class="bento-stub" :data-stub-kind="cell.kind" />
      </template>
    </BentoGrid>
  </div>
</template>

<style scoped>
.bento-view {
  /* Fill the parent wrapper (LinearView sets position:relative on it)
     and serve as the positioning context for the absolutely-positioned
     BentoGrid inside. */
  position: absolute;
  inset: 0;
  background-color: var(--p-content-background, #1a1a1a);
}

.bento-stub {
  width: 100%;
  height: 100%;
}
</style>
