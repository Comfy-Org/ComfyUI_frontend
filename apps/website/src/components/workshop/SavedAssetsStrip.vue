<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'

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
import {
  mergeGenerations,
  savedAssetTiles
} from '../../lib/workshop/saved-assets'
import type {
  SavedAsset,
  SavedAssetTile as SavedAssetTileData
} from '../../lib/workshop/saved-assets'
import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'
import SavedAssetPreview from './SavedAssetPreview.vue'
import SavedAssetTile from './SavedAssetTile.vue'

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
const ACCESS_RETRY_MS = 15_000
const ACCESS_PASSES = 8

const generations = ref<SavedGeneration[]>([])
const access = ref(
  new Map<string, { url?: string; expiresAt: number; renewAt: number }>()
)
const unavailable = ref(new Set<string>())
const failed = ref(false)
const viewingKey = ref<string>()
const cancelling = ref(false)
const cancelFailed = ref(false)

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
  viewing.value ? urlFor(viewing.value) : undefined
)
const viewingIndex = computed(() =>
  savedTiles.value.findIndex((tile) => tile.key === viewing.value?.key)
)
const position = computed(() => ({
  index: Math.max(0, viewingIndex.value),
  total: savedTiles.value.length
}))

function step(delta: number) {
  const next = savedTiles.value[viewingIndex.value + delta]
  if (next) viewingKey.value = next.key
}

function urlFor(tile: SavedAssetTileData): string | undefined {
  return tile.state === 'saved'
    ? access.value.get(tile.assetId)?.url
    : undefined
}

function tileLabel(tile: SavedAssetTileData): string {
  return t(
    tile.state === 'pending'
      ? 'workshop.assets.generating'
      : 'workshop.assets.open',
    locale
  )
}

function current(attempt: number): boolean {
  return !controller.signal.aborted && attempt === sequence
}

// The run just started is the one the reader is waiting on, so it is worth a
// second call when the list has not caught up with it yet.
async function listWithActive(credential: string) {
  const page = await listWorkshopGenerations(
    credential,
    controller.signal,
    modelId
  )
  if (
    !activeRequestId ||
    page.requests.some((request) => request.request_id === activeRequestId)
  )
    return page.requests
  const active = await getWorkshopGeneration(
    modelId,
    activeRequestId,
    credential,
    controller.signal
  )
  return active ? [active, ...page.requests] : page.requests
}

function schedulePoll() {
  if (!failed.value && !generations.value.some(generationPending)) return
  listTimer = setTimeout(
    () => void refresh(),
    failed.value ? FAILED_POLL_MS : PENDING_POLL_MS
  )
}

async function refresh() {
  const attempt = ++sequence
  clearTimeout(listTimer)
  try {
    const requests = await listWithActive(await token())
    if (!current(attempt)) return
    generations.value = mergeGenerations(generations.value, requests)
    failed.value = false
  } catch {
    if (!current(attempt)) return
    failed.value = true
  } finally {
    if (current(attempt)) {
      schedulePoll()
      void resolveAccess()
    }
  }
}

function gone(error: unknown): boolean {
  return (
    error instanceof GenerationAccessError &&
    (error.status === 404 || error.status === 410)
  )
}

async function grantAccess(tile: SavedAsset) {
  try {
    const granted = await accessWorkshopAsset(
      tile.assetId,
      await token(),
      controller.signal
    )
    if (controller.signal.aborted) return
    const expiresAt = Date.parse(granted.expires_at)
    access.value.set(tile.assetId, {
      url: granted.content_url,
      expiresAt,
      renewAt: renewAt(expiresAt)
    })
  } catch (error) {
    if (controller.signal.aborted) return
    if (gone(error)) {
      unavailable.value.add(tile.assetId)
      access.value.delete(tile.assetId)
      return
    }
    // A failed renewal must not take away a grant that still has time on it:
    // the headroom is there so the old URL covers the retry, and dropping it
    // unmounts the player mid-playback. Without a deadline nothing asks again.
    const held = access.value.get(tile.assetId)
    const kept = held && held.expiresAt > Date.now() ? held : undefined
    access.value.set(tile.assetId, {
      url: kept?.url,
      expiresAt: kept?.expiresAt ?? 0,
      renewAt: Date.now() + ACCESS_RETRY_MS
    })
  }
}

/** A signed URL that lapses while the reader is looking at it breaks the
 * picture, so the next grant is fetched before the current one runs out. A
 * grant shorter than the headroom would otherwise renew on every tick, so a
 * short one is renewed halfway through instead. */
function renewAt(expiresAt: number): number {
  return expiresAt - Math.min(ACCESS_HEADROOM_MS, (expiresAt - Date.now()) / 2)
}

// Retiring an asset uncovers the one behind it, which needs a grant of its own,
// so the sweep repeats until the visible set stops moving. Each pass either
// grants a URL or retires an asset, so it settles; the bound is a backstop.
async function resolveAccess() {
  for (let pass = 0; pass < ACCESS_PASSES; pass += 1) {
    const now = Date.now()
    const due = savedTiles.value.filter(
      (tile) => (access.value.get(tile.assetId)?.renewAt ?? 0) <= now
    )
    if (!due.length) break
    await Promise.all(due.map(grantAccess))
  }
  scheduleRenewal()
}

// Only what the reader can see is worth renewing. An asset pushed out of the
// strip keeps a deadline that nothing advances, and its lapsed time would pin
// the timer to its one-second floor for as long as the page stayed open.
function scheduleRenewal() {
  clearTimeout(accessTimer)
  if (controller.signal.aborted) return
  const visible = savedTiles.value.map((tile) => tile.assetId)
  const shown = new Set(visible)
  for (const assetId of [...access.value.keys()])
    if (!shown.has(assetId)) access.value.delete(assetId)
  if (!visible.length) return
  const due = visible.map(
    (assetId) =>
      access.value.get(assetId)?.renewAt ?? Date.now() + ACCESS_RETRY_MS
  )
  accessTimer = setTimeout(
    () => void resolveAccess(),
    Math.max(1_000, Math.min(...due) - Date.now())
  )
}

function mediaError(tile: SavedAssetTileData) {
  if (tile.state !== 'saved' || retried.has(tile.assetId)) return
  retried.add(tile.assetId)
  access.value.delete(tile.assetId)
  void resolveAccess()
}

async function cancel() {
  const tile = viewing.value
  if (cancelling.value || tile?.state !== 'pending') return
  cancelling.value = true
  cancelFailed.value = false
  try {
    await cancelWorkshopGeneration(
      tile.generation,
      await token(),
      controller.signal
    )
    if (controller.signal.aborted) return
    viewingKey.value = undefined
    await refresh()
  } catch {
    if (!controller.signal.aborted) cancelFailed.value = true
  } finally {
    cancelling.value = false
  }
}

function open(key: string) {
  cancelFailed.value = false
  viewingKey.value = key
}

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
        :aria-label="tileLabel(tile)"
        :class="tileClass"
        :data-testid="`saved-asset-${index}`"
        @click="open(tile.key)"
      >
        <SavedAssetTile
          :tile
          :url="urlFor(tile)"
          @media-error="mediaError(tile)"
        />
      </button>
    </div>

    <SavedAssetPreview
      :tile="viewing"
      :url="viewingUrl"
      :cancelling
      :cancel-failed="cancelFailed"
      :position
      :locale
      @close="viewingKey = undefined"
      @cancel="cancel"
      @step="step"
    />
  </section>
</template>
