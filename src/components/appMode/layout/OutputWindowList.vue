<script setup lang="ts">
/**
 * OutputWindowList — renders one OutputWindow per entry in
 * `outputWindowStore`, building the App Mode moodboard.
 *
 * The store is fed by `useOutputWindowSync`, which projects the
 * lifecycle from `linearOutputStore.activeWorkflowInProgressItems`
 * into windows AND resolves each finalized window's owning
 * AssetItem from `outputs.media`. This component only handles the
 * spatial / chrome concerns — position, zIndex on focus, body
 * content per state, hover toolbar (rerun / reuse-params /
 * download), header menu (close / clear-all), and the run-status
 * overlay attached to whichever window is in-flight.
 */
import { storeToRefs } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { isCloud } from '@/platform/distribution/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import type { OutputWindowEntry } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { ResultItemImpl } from '@/stores/queueStore'
import { app } from '@/scripts/app'
import { resolveNode } from '@/utils/litegraphUtil'

import OutputWindow from './OutputWindow.vue'

const { t } = useI18n()
const windowStore = useOutputWindowStore()
const { sortedWindows, windows } = storeToRefs(windowStore)
const commandStore = useCommandStore()
const appModeStore = useAppModeStore()
const { toastErrorHandler } = useErrorHandling()

defineProps<{
  /** Blended progress (0-100) for the run-status overlay attached to
   *  the in-flight window. LinearPreview owns the math; we just bind. */
  progressPercent: number
  /** Step counter / ETA copy for the overlay. Both nullable — neither
   *  exists during cold-load, only step exists between encoder and
   *  sampler, both exist mid-sampler. */
  stepProgress: { value: number; max: number } | null
  etaSeconds: number | null
  formatEta: (s: number) => string
}>()

// Title from the source output node — same label graph view shows
// on its image-output node ("Save Image" / "Save Video" / user-renamed).
function titleFor(entry: OutputWindowEntry): string | undefined {
  const nodeId = entry.output?.nodeId
  if (nodeId === undefined) return undefined
  const node = resolveNode(nodeId)
  return node?.title || undefined
}

function filenameFor(entry: OutputWindowEntry): string | undefined {
  const out = entry.output
  if (!out) return undefined
  return out.display_name?.trim() || out.filename || undefined
}

// Cloud-mode URL fix: assets live under `asset.asset_hash`, not the
// user-facing filename, so the original `output.url` builds
// `/view?filename=<original>` which 404s in Cloud. Re-clone the
// ResultItem with the hash as the filename param when we have the
// resolved asset; OSS mode passes through unchanged.
function resolvedOutput(entry: OutputWindowEntry): ResultItemImpl | undefined {
  const out = entry.output
  if (!out) return undefined
  if (!isCloud) return out
  const hash = entry.asset?.asset_hash
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
}

const BODY_ACTION_CLASS =
  'flex h-8 min-h-8 cursor-pointer items-center justify-center ' +
  'rounded-lg border-0 bg-base-foreground p-2 text-base-background ' +
  'shadow-interface transition-colors duration-200 ' +
  'hover:bg-base-foreground/90 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-base-foreground ' +
  'focus-visible:ring-offset-2'

// In-flight window: the topmost window still in skeleton/latent
// state. The run-status overlay (progress + cancel) lives on that
// window only — once it transitions to `image`, the overlay drops.
const inFlightWindowId = computed<string | null>(() => {
  for (let i = sortedWindows.value.length - 1; i >= 0; i--) {
    const w = sortedWindows.value[i]
    if (w.state !== 'image') return w.id
  }
  return null
})

async function windowInterrupt(): Promise<void> {
  try {
    await commandStore.execute('Comfy.Interrupt')
  } catch (error) {
    toastErrorHandler(error)
  }
}

function downloadOutput(entry: OutputWindowEntry): void {
  const out = resolvedOutput(entry)
  if (out?.url) downloadFile(out.url)
}

// Load the window's source workflow into the graph view. Both rerun
// and reuse-params funnel through this — the difference is rerun
// fires QueuePrompt afterwards. Mirrors LinearPreview's existing
// loadWorkflow but scoped to a single window's asset.
async function loadAssetWorkflow(entry: OutputWindowEntry): Promise<void> {
  const asset = entry.asset
  if (!asset) return
  const { workflow } = await extractWorkflowFromAsset(asset)
  if (!workflow) return
  if (workflow.id !== app.rootGraph?.id) {
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

async function rerunWindow(entry: OutputWindowEntry): Promise<void> {
  await loadAssetWorkflow(entry)
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

function menuEntriesFor(entry: OutputWindowEntry): MenuItem[] {
  const entries: MenuItem[] = [
    {
      icon: 'icon-[lucide--x] size-[18px]',
      label: t('linearMode.outputs.closeWindow'),
      command: () => windowStore.remove(entry.id)
    }
  ]
  // "Clear all" only appears when there are other windows to clear —
  // on a single-window canvas the per-window close already does it.
  if (windows.value.length > 1) {
    entries.push({ separator: true })
    entries.push({
      icon: 'icon-[lucide--trash-2] size-[18px]',
      label: t('linearMode.outputs.clearAll'),
      command: () => windowStore.clear()
    })
  }
  return entries
}
</script>

<template>
  <OutputWindow
    v-for="entry in sortedWindows"
    :key="entry.id"
    :title="titleFor(entry)"
    :filename="filenameFor(entry)"
    :menu-entries="menuEntriesFor(entry)"
    :initial-position="entry.position"
    :z-index="entry.zIndex"
    @update:position="(pos) => windowStore.move(entry.id, pos)"
    @promote="windowStore.promote(entry.id)"
  >
    <template v-if="entry.state === 'image' && entry.output">
      <MediaOutputPreview
        :output="resolvedOutput(entry) ?? entry.output"
        :hide-info="true"
        class="size-full"
      />
    </template>
    <template v-else-if="entry.state === 'latent' && entry.latentPreviewUrl">
      <ImagePreview
        :src="entry.latentPreviewUrl"
        :show-size="false"
        class="size-full"
      />
    </template>
    <template v-else>
      <LatentPreview class="size-full" />
    </template>

    <template #body-actions>
      <!-- Rerun / reuse-params only when the window has a resolved
           asset (i.e. the run finalized and landed in `outputs.media`).
           In-flight or absorption-pending windows hide both. -->
      <button
        v-if="entry.asset"
        type="button"
        :class="BODY_ACTION_CLASS"
        :title="t('linearMode.rerun')"
        :aria-label="t('linearMode.rerun')"
        @click="rerunWindow(entry)"
      >
        <i class="icon-[lucide--refresh-cw] size-4" />
      </button>
      <button
        v-if="entry.asset"
        type="button"
        :class="BODY_ACTION_CLASS"
        :title="t('linearMode.reuseParameters')"
        :aria-label="t('linearMode.reuseParameters')"
        @click="loadAssetWorkflow(entry)"
      >
        <i class="icon-[lucide--list-restart] size-4" />
      </button>
      <button
        v-if="entry.output"
        type="button"
        :class="BODY_ACTION_CLASS"
        :title="t('g.download')"
        :aria-label="t('g.download')"
        @click="downloadOutput(entry)"
      >
        <i class="icon-[lucide--download] size-4" />
      </button>
    </template>

    <template #body-overlay>
      <div
        v-if="entry.id === inFlightWindowId && entry.state !== 'image'"
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
</template>
