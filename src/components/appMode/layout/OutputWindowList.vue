<script setup lang="ts">
/**
 * OutputWindowList — renders one OutputWindow per entry in
 * `outputWindowStore`, building the App Mode moodboard.
 *
 * The store is fed by `useOutputWindowSync`, which projects the
 * lifecycle from `linearOutputStore.activeWorkflowInProgressItems`
 * into windows. This component only handles the spatial / chrome
 * concerns — position, zIndex on focus, body content per state, and
 * the run-status overlay attached to whichever window is in-flight.
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import type { OutputWindowEntry } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { resolveNode } from '@/utils/litegraphUtil'

import OutputWindow from './OutputWindow.vue'

const { t } = useI18n()
const windowStore = useOutputWindowStore()
const { sortedWindows } = storeToRefs(windowStore)
const commandStore = useCommandStore()
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

// NOTE: Cloud-mode URL fix (re-clone with `asset.asset_hash` as
// filename) lived on the single-window path. In-progress items don't
// carry the asset hash, so the fix moves to the asset-resolution
// step in commit 3 where we look up the AssetItem from the window's
// output. Until then Cloud mode 404s on these previews — the local-
// mode flow we're testing against doesn't hit this.

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
  const url = entry.output?.url
  if (url) downloadFile(url)
}
</script>

<template>
  <OutputWindow
    v-for="entry in sortedWindows"
    :key="entry.id"
    :title="titleFor(entry)"
    :filename="filenameFor(entry)"
    :initial-position="entry.position"
    :z-index="entry.zIndex"
    @update:position="(pos) => windowStore.move(entry.id, pos)"
    @promote="windowStore.promote(entry.id)"
  >
    <!-- Body content selects on lifecycle state. `key` is stable per
         (entry, state) so Transition crossfades cleanly when an item
         walks skeleton → latent → image. -->
    <template v-if="entry.state === 'image' && entry.output">
      <MediaOutputPreview
        :output="entry.output"
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
