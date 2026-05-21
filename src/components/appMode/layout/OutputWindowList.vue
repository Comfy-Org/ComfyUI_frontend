<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { isCloud } from '@/platform/distribution/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import type { OutputWindowEntry } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useCommandStore } from '@/stores/commandStore'
import { ResultItemImpl } from '@/stores/queueStore'
import { app } from '@/scripts/app'

import OutputWindow from './OutputWindow.vue'

const { t } = useI18n()
const windowStore = useOutputWindowStore()
const { sortedWindows } = storeToRefs(windowStore)
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

defineProps<{
  /** Blended 0–100. */
  progressPercent: number
  stepProgress: { value: number; max: number } | null
  etaSeconds: number | null
  formatEta: (s: number) => string
}>()

function filenameFor(entry: OutputWindowEntry): string | undefined {
  const out = entry.output
  return out?.display_name?.trim() || out?.filename || undefined
}

// Cloud: re-clone with `asset_hash` to hit the right URL. OSS: pass-through.
function resolvedOutput(entry: OutputWindowEntry): ResultItemImpl | undefined {
  const out = entry.output
  if (!out) return undefined
  const hash = isCloud ? entry.asset?.asset_hash : undefined
  if (!hash) return out
  return new ResultItemImpl({
    filename: hash,
    subfolder: out.subfolder,
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
const HEADER_ACTION_CLASS =
  'inline-flex size-8 cursor-pointer items-center justify-center ' +
  'rounded-md border-0 bg-transparent text-layout-text ' +
  'transition-colors duration-layout ease-layout ' +
  'hover:bg-layout-cell-hover focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-base-foreground/40 ' +
  '[&>i]:size-[18px]'

function aspectSourceUrl(entry: OutputWindowEntry): string | undefined {
  return resolvedOutput(entry)?.url ?? entry.latentPreviewUrl
}
watch(
  () => sortedWindows.value.map((w) => ({ id: w.id, url: aspectSourceUrl(w) })),
  (entries) => {
    for (const { id, url } of entries) {
      if (!url) continue
      const probe = new Image()
      probe.onload = () => {
        // Race guard for latent → final URL swap.
        const current = windowStore.windows.find((w) => w.id === id)
        if (!current || aspectSourceUrl(current) !== url) return
        if (probe.naturalWidth <= 0 || probe.naturalHeight <= 0) return
        windowStore.attachAspect(id, probe.naturalWidth / probe.naturalHeight)
      }
      probe.src = url
    }
  },
  { immediate: true, deep: true }
)

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
  const url = resolvedOutput(entry)?.url
  if (url) downloadFile(url)
}

async function loadAssetWorkflow(entry: OutputWindowEntry): Promise<boolean> {
  const asset = entry.asset
  if (!asset) return false
  const { workflow } = await extractWorkflowFromAsset(asset)
  if (!workflow) return false
  if (workflow.id !== app.rootGraph?.id) {
    await app.loadGraphData(workflow)
    return true
  }
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) {
    await app.loadGraphData(workflow)
    return true
  }
  changeTracker.redoQueue = []
  await changeTracker.updateState([workflow], changeTracker.undoQueue)
  return true
}

async function rerunWindow(entry: OutputWindowEntry): Promise<void> {
  try {
    // Don't fall through to QueuePrompt on no-workflow — that would
    // run the currently loaded graph instead of the output's source.
    if (!(await loadAssetWorkflow(entry))) return
  } catch (error) {
    toastErrorHandler(error)
    return
  }
  try {
    await commandStore.execute('Comfy.QueuePrompt', {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    toastErrorHandler(error)
  }
}

async function reuseParams(entry: OutputWindowEntry): Promise<void> {
  try {
    await loadAssetWorkflow(entry)
  } catch (error) {
    toastErrorHandler(error)
  }
}

// TODO: "Clear all output windows" used to live in a per-tile ⋯ menu
// alongside "Close window". The ⋯ menu is gone now (closing one tile
// is a single-click ✕ in the header). Resurface clear-all somewhere
// chrome-level — likely the bottom corner cluster or the App-mode
// settings menu — instead of duplicating it on every tile.
</script>

<template>
  <OutputWindow
    v-for="entry in sortedWindows"
    :key="entry.id"
    :title="filenameFor(entry)"
    :initial-position="entry.position"
    :initial-width="entry.width"
    :initial-height="entry.height"
    :z-index="entry.zIndex"
    :body-aspect="entry.aspect"
    @update:position="(pos) => windowStore.move(entry.id, pos)"
    @update:size="(size) => windowStore.resize(entry.id, size)"
    @promote="windowStore.promote(entry.id)"
  >
    <template #header-actions-left>
      <button
        v-if="entry.output"
        type="button"
        data-header-control
        :class="HEADER_ACTION_CLASS"
        :title="t('g.download')"
        :aria-label="t('g.download')"
        @pointerdown.stop
        @click="downloadOutput(entry)"
      >
        <i class="icon-[lucide--download]" />
      </button>
    </template>
    <template #header-actions-right>
      <button
        type="button"
        data-header-control
        :class="HEADER_ACTION_CLASS"
        :title="t('linearMode.outputs.closeWindow')"
        :aria-label="t('linearMode.outputs.closeWindow')"
        @pointerdown.stop
        @click="windowStore.remove(entry.id)"
      >
        <i class="icon-[lucide--x]" />
      </button>
    </template>

    <template v-if="entry.state === 'image' && entry.output">
      <!-- `cover` in both modes — bounded-fit placement caps aspect
           mismatch at ~20% so the crop stays small, and avoiding
           letterbox bars reads more polished than the alternative. -->
      <MediaOutputPreview
        :output="resolvedOutput(entry) ?? entry.output"
        :hide-info="true"
        fit="cover"
        class="size-full"
      />
    </template>
    <template v-else-if="entry.state === 'latent' && entry.latentPreviewUrl">
      <!-- `object-cover` matches MediaOutputPreview so the latent →
           final swap stays visually seamless. -->
      <img
        :src="entry.latentPreviewUrl"
        class="size-full object-cover"
        alt=""
      />
    </template>
    <template v-else>
      <LatentPreview class="size-full" :variant="entry.createdSeq" />
    </template>

    <template #body-actions>
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
        @click="reuseParams(entry)"
      >
        <i class="icon-[lucide--list-restart] size-4" />
      </button>
    </template>

    <template #body-overlay>
      <div
        v-if="entry.id === inFlightWindowId && entry.state !== 'image'"
        class="pointer-events-auto flex w-[360px] items-center gap-3 rounded-xl bg-(--comfy-menu-bg)/95 p-3 shadow-2xl backdrop-blur-md"
        data-testid="output-window-run-status"
      >
        <div
          class="relative h-8 flex-1 overflow-hidden rounded-lg border border-(--border-color) bg-(--fg-color)/10"
          role="progressbar"
          :aria-label="t('linearMode.runProgress')"
          :aria-valuenow="progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full bg-success-background transition-[width] duration-300 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
          <div
            class="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-xs text-(--fg-color) tabular-nums"
          >
            <span>
              <template v-if="stepProgress">{{
                t('linearMode.outputs.step', {
                  value: stepProgress.value,
                  max: stepProgress.max
                })
              }}</template>
            </span>
            <span>
              <template v-if="etaSeconds !== null">{{
                formatEta(etaSeconds)
              }}</template>
            </span>
          </div>
        </div>
        <button
          type="button"
          :class="
            cn(
              'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg',
              'border-0 bg-destructive-background text-(--destructive-foreground)',
              'transition-[filter] duration-200 hover:brightness-110',
              'focus-visible:ring-2 focus-visible:ring-(--destructive-foreground)/70 focus-visible:outline-none'
            )
          "
          :title="t('linearMode.stop')"
          :aria-label="t('linearMode.stop')"
          data-testid="output-window-cancel-run"
          @click="windowInterrupt"
        >
          <i class="icon-[lucide--x] size-4" />
        </button>
      </div>
    </template>
  </OutputWindow>
</template>
