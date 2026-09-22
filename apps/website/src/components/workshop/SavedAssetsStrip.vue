<script setup lang="ts">
import {
  Download,
  ExternalLink,
  File as FileIcon,
  Loader2,
  X
} from '@lucide/vue'
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import {
  accessWorkshopAsset,
  cancelWorkshopGeneration,
  GenerationAccessError,
  generationPending,
  getWorkshopGeneration,
  listWorkshopGenerations
} from '../../config/workshop-generation-assets'
import type { SavedGeneration } from '../../config/workshop-generation-assets'
import { WORKSHOP_ASSETS_URL } from '../../config/workshop-env'
import { downloadOutput } from '../../config/workshop-output-download'
import {
  mergeGenerations,
  savedAssetFileName,
  savedAssetTiles
} from '../../lib/workshop/saved-assets'
import type { SavedAsset } from '../../lib/workshop/saved-assets'
import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'

const {
  modelId,
  activeRequestId,
  token,
  locale = 'en'
} = defineProps<{
  modelId: string
  activeRequestId: string | null
  token: () => Promise<string>
  locale?: Locale
}>()

const PENDING_POLL_MS = 3_000
const FAILED_POLL_MS = 15_000
const ACCESS_HEADROOM_MS = 30_000

const generations = ref<SavedGeneration[]>([])
const access = ref(new Map<string, { url: string; expiresAt: number }>())
const unavailable = ref(new Set<string>())
const failed = ref(false)
const viewingKey = ref<string>()
const cancelling = ref(false)
const cancelFailed = ref(false)
const downloadFailed = ref(false)

const retried = new Set<string>()
const controller = new AbortController()
let listTimer: ReturnType<typeof setTimeout> | undefined
let accessTimer: ReturnType<typeof setTimeout> | undefined
let sequence = 0

const tiles = computed(() =>
  savedAssetTiles(generations.value, unavailable.value)
)
const savedTiles = computed(() =>
  tiles.value.filter((tile): tile is SavedAsset => tile.state === 'saved')
)

// A generation the reader opened while it was still running is the same piece
// of work as the asset it turns into, so the preview follows it there instead
// of closing under them.
const viewing = computed(
  () =>
    tiles.value.find((tile) => tile.key === viewingKey.value) ??
    savedTiles.value.find((tile) => tile.requestId === viewingKey.value)
)
const viewingUrl = computed(() =>
  viewing.value?.state === 'saved'
    ? access.value.get(viewing.value.assetId)?.url
    : undefined
)

function urlFor(tile: SavedAsset): string | undefined {
  return access.value.get(tile.assetId)?.url
}

async function refresh() {
  const attempt = ++sequence
  clearTimeout(listTimer)
  try {
    const credential = await token()
    const page = await listWorkshopGenerations(
      credential,
      controller.signal,
      modelId
    )
    // The run just started is the one the reader is waiting on, so it is worth
    // a second call when the list has not caught up with it yet.
    if (
      activeRequestId &&
      !page.requests.some((request) => request.request_id === activeRequestId)
    ) {
      const active = await getWorkshopGeneration(
        modelId,
        activeRequestId,
        credential,
        controller.signal
      )
      if (active) page.requests.unshift(active)
    }
    if (controller.signal.aborted || attempt !== sequence) return
    generations.value = mergeGenerations(generations.value, page.requests)
    failed.value = false
  } catch {
    if (controller.signal.aborted || attempt !== sequence) return
    failed.value = true
  } finally {
    if (!controller.signal.aborted && attempt === sequence) {
      if (failed.value || generations.value.some(generationPending))
        listTimer = setTimeout(
          () => void refresh(),
          failed.value ? FAILED_POLL_MS : PENDING_POLL_MS
        )
      void resolveAccess()
    }
  }
}

async function resolveAccess() {
  const now = Date.now()
  const wanted = savedTiles.value.filter(
    (tile) => (access.value.get(tile.assetId)?.expiresAt ?? 0) <= now
  )
  await Promise.all(
    wanted.map(async (tile) => {
      try {
        const granted = await accessWorkshopAsset(
          tile.assetId,
          await token(),
          controller.signal
        )
        if (controller.signal.aborted) return
        access.value.set(tile.assetId, {
          url: granted.content_url,
          expiresAt: Date.parse(granted.expires_at)
        })
      } catch (error) {
        if (controller.signal.aborted) return
        if (
          error instanceof GenerationAccessError &&
          (error.status === 404 || error.status === 410)
        ) {
          unavailable.value.add(tile.assetId)
          access.value.delete(tile.assetId)
        }
      }
    })
  )
  scheduleRenewal()
}

/** A signed URL that lapses while the reader is looking at it breaks the
 * picture, so the next grant is fetched before the current one runs out. */
function scheduleRenewal() {
  clearTimeout(accessTimer)
  const expiries = [...access.value.values()].map((entry) => entry.expiresAt)
  if (!expiries.length || controller.signal.aborted) return
  accessTimer = setTimeout(
    () => void resolveAccess(),
    Math.max(1_000, Math.min(...expiries) - ACCESS_HEADROOM_MS - Date.now())
  )
}

function mediaError(tile: SavedAsset) {
  if (retried.has(tile.assetId)) return
  retried.add(tile.assetId)
  access.value.delete(tile.assetId)
  void resolveAccess()
}

async function cancel(generation: SavedGeneration) {
  if (cancelling.value) return
  cancelling.value = true
  cancelFailed.value = false
  try {
    await cancelWorkshopGeneration(generation, await token(), controller.signal)
    if (!controller.signal.aborted) {
      viewingKey.value = undefined
      await refresh()
    }
  } catch {
    if (!controller.signal.aborted) cancelFailed.value = true
  } finally {
    cancelling.value = false
  }
}

async function download(event: MouseEvent) {
  const tile = viewing.value
  const url = viewingUrl.value
  if (tile?.state !== 'saved' || !url) return
  if (downloadFailed.value) return
  event.preventDefault()
  downloadFailed.value = !(await downloadOutput(
    url,
    savedAssetFileName(tile.assetId, tile.kind, url)
  ))
}

watch(viewingKey, () => {
  downloadFailed.value = false
  cancelFailed.value = false
})
watch(
  () => activeRequestId,
  () => void refresh()
)

onMounted(() => void refresh())
onScopeDispose(() => {
  controller.abort()
  clearTimeout(listTimer)
  clearTimeout(accessTimer)
})

const tileClass =
  'relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-transparent bg-transparency-white-t4 text-primary-warm-gray opacity-80 transition-opacity hover:opacity-100 focus-visible:border-primary-comfy-yellow focus-visible:outline-none'
</script>

<template>
  <section
    v-if="tiles.length || failed"
    :aria-label="t('workshop.assets.title', locale)"
    class="flex flex-col gap-3 rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-4"
    data-testid="saved-assets"
  >
    <div class="flex items-center justify-between gap-3">
      <h2
        class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('workshop.assets.title', locale) }}
      </h2>
      <a
        :href="WORKSHOP_ASSETS_URL"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-xs text-primary-warm-gray transition-colors hover:text-primary-comfy-yellow"
        data-testid="saved-assets-see-all"
      >
        {{ t('workshop.assets.seeAll', locale) }}
        <ExternalLink class="size-3.5" aria-hidden="true" />
      </a>
    </div>

    <p v-if="failed" role="alert" class="text-xs text-primary-warm-gray">
      {{ t('workshop.assets.loadError', locale) }}
    </p>

    <div v-if="tiles.length" class="flex items-center gap-2 overflow-x-auto">
      <button
        v-for="(tile, index) in tiles"
        :key="tile.key"
        type="button"
        :aria-label="
          t(
            tile.state === 'pending'
              ? 'workshop.assets.generating'
              : 'workshop.assets.open',
            locale
          )
        "
        :class="tileClass"
        :data-testid="`saved-asset-${index}`"
        @click="viewingKey = tile.key"
      >
        <template v-if="tile.state === 'saved'">
          <video
            v-if="tile.kind === 'video' && urlFor(tile)"
            :src="urlFor(tile)"
            class="size-full object-cover"
            muted
            playsinline
            preload="metadata"
            @error="mediaError(tile)"
          />
          <img
            v-else-if="tile.kind === 'image' && urlFor(tile)"
            :src="urlFor(tile)"
            alt=""
            class="size-full object-cover"
            @error="mediaError(tile)"
          />
          <FileIcon v-else class="size-5" aria-hidden="true" />
        </template>
        <Loader2
          v-else
          class="size-5 text-primary-comfy-yellow motion-safe:animate-spin"
          aria-hidden="true"
        />
      </button>
    </div>

    <DialogRoot
      :open="viewing !== undefined"
      @update:open="(open: boolean) => !open && (viewingKey = undefined)"
    >
      <DialogPortal>
        <DialogContent
          v-if="viewing"
          class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-4 bg-primary-comfy-ink/90 p-6 backdrop-blur-sm"
          :aria-describedby="undefined"
          data-testid="saved-asset-preview"
          @click.self="viewingKey = undefined"
        >
          <DialogTitle class="sr-only">
            {{ t('workshop.assets.title', locale) }}
          </DialogTitle>
          <button
            type="button"
            :aria-label="t('workshop.output.collapse', locale)"
            class="absolute top-6 right-6 grid size-8 cursor-pointer place-items-center rounded-lg bg-primary-comfy-ink/70 text-primary-warm-white transition-colors hover:text-primary-comfy-yellow"
            data-testid="saved-asset-close"
            @click="viewingKey = undefined"
          >
            <X class="size-4" aria-hidden="true" />
          </button>

          <template v-if="viewing.state === 'saved' && viewingUrl">
            <img
              v-if="viewing.kind === 'image'"
              :src="viewingUrl"
              :alt="t('workshop.assets.title', locale)"
              class="max-h-[80dvh] max-w-full rounded-2xl object-contain"
            />
            <video
              v-else-if="viewing.kind === 'video'"
              :src="viewingUrl"
              class="max-h-[80dvh] max-w-full rounded-2xl"
              controls
              autoplay
              loop
              playsinline
            />
            <audio v-else :src="viewingUrl" class="w-full max-w-md" controls />
            <Button
              as="a"
              :href="viewingUrl"
              :download="
                downloadFailed
                  ? undefined
                  : savedAssetFileName(
                      viewing.assetId,
                      viewing.kind,
                      viewingUrl
                    )
              "
              :prepend-icon="downloadFailed ? ExternalLink : Download"
              target="_blank"
              rel="noopener"
              size="sm"
              data-testid="saved-asset-download"
              @click="download"
            >
              {{
                t(
                  downloadFailed
                    ? 'workshop.output.openOriginal'
                    : 'workshop.output.download',
                  locale
                )
              }}
            </Button>
          </template>

          <template v-else-if="viewing.state === 'pending'">
            <Loader2
              class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
              aria-hidden="true"
            />
            <p class="text-sm text-primary-warm-white">
              {{ t('workshop.assets.generating', locale) }}
            </p>
            <p
              v-if="cancelFailed"
              role="alert"
              class="text-xs text-primary-comfy-red"
            >
              {{ t('workshop.assets.cancelError', locale) }}
            </p>
            <Button
              variant="outline"
              size="sm"
              :disabled="cancelling"
              @click="cancel(viewing.generation)"
            >
              {{ t('workshop.run.cancel', locale) }}
            </Button>
          </template>

          <p v-else role="status" class="text-sm text-primary-warm-gray">
            {{ t('workshop.assets.loadingMedia', locale) }}
          </p>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>
