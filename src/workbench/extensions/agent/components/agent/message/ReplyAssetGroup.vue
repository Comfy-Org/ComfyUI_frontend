<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  markRaw,
  onBeforeUnmount,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { generateModelThumbnail } from '@/components/load3d/modelThumbnail'
import {
  findOutputAsset,
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

import type { ReplyAsset } from '../../../utils/replyAssets'
import { replyAssetResultItem } from '../../../utils/replyAssets'
import ReplyAudioCard from './ReplyAudioCard.vue'

const { assets } = defineProps<{ assets: ReplyAsset[] }>()

const { t } = useI18n()

/* Three rows of the four-column grid, per DES-530. */
const COLLAPSED_COUNT = 12

const visual = computed(() => assets.filter((asset) => asset.kind !== 'audio'))
const audio = computed(() => assets.filter((asset) => asset.kind === 'audio'))

const expanded = ref(false)
const collapsible = computed(() => visual.value.length > COLLAPSED_COUNT)
const visibleVisual = computed(() =>
  expanded.value || !collapsible.value
    ? visual.value
    : visual.value.slice(0, COLLAPSED_COUNT)
)

const multi = computed(() => visual.value.length > 1)

const AUDIO_COLLAPSED_COUNT = 5

const audioExpanded = ref(false)
const audioCollapsible = computed(
  () => audio.value.length > AUDIO_COLLAPSED_COUNT
)
const visibleAudio = computed(() =>
  audioExpanded.value || !audioCollapsible.value
    ? audio.value
    : audio.value.slice(0, AUDIO_COLLAPSED_COUNT)
)

const gridColsClass = computed(() => {
  const count = visual.value.length
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  return 'grid-cols-4'
})

const galleryAssets = computed(() =>
  visual.value.filter((asset) => asset.kind !== '3D')
)
const galleryItems = computed(() =>
  galleryAssets.value.map(replyAssetResultItem)
)
const galleryIndex = ref(-1)

/**
 * One entry per model url. Three parallel structures (a thumbnail map, an
 * abort-controller map, a retried-once set) used to track this and could
 * disagree — a `''` placeholder meant both "in flight" and "gave up",
 * which is what let a hidden/re-shown tile end up permanently blank (see
 * `setVisible` below). Now dropping the entry and aborting its render are
 * the same synchronous act, so the watcher can always tell an owned strand
 * from a superseded one.
 *
 * `controller` must be `markRaw`: a `ref`/reactive object deep-proxies
 * nested objects, so an unwrapped `state.controller === controller`
 * comparison would compare a proxy against the raw controller and always
 * be false, silently disowning every pending strand.
 */
type ThumbnailState =
  | { phase: 'loading'; controller: AbortController }
  | { phase: 'ready'; src: string }
  | { phase: 'gaveUp'; attempts: number }

const MAX_THUMBNAIL_RETRY_ATTEMPTS = 2
const THUMBNAIL_RETRY_DELAY_MS = 2000

const thumbnailState = ref<Record<string, ThumbnailState>>({})
const assetNames = ref<Record<string, string>>({})
const refreshTimeouts = new Set<ReturnType<typeof setTimeout>>()
let mounted = true
onBeforeUnmount(() => {
  mounted = false
  for (const state of Object.values(thumbnailState.value)) {
    if (state.phase === 'loading') state.controller.abort()
  }
  for (const timeout of refreshTimeouts) clearTimeout(timeout)
  refreshTimeouts.clear()
})

/** Whether `url`'s current entry is still the `loading` strand owned by `controller`. */
function owns(url: string, controller: AbortController): boolean {
  const state = thumbnailState.value[url]
  return state?.phase === 'loading' && state.controller === controller
}

/**
 * Look up a server-rendered preview, falling back to an offscreen render.
 * Per-url controller: `hideThumbnail` aborts it when the asset leaves
 * `visibleVisual` ("Show less" no longer leaves hidden renders running
 * against the shared queue), and `showThumbnail` restarts it, so Show more
 * -> Show less -> Show more never strands a tile blank.
 */
function loadModelThumbnail(url: string, filename: string): void {
  const controller = markRaw(new AbortController())
  thumbnailState.value[url] = { phase: 'loading', controller }

  void findServerPreviewUrl(filename)
    .then(async (preview) => {
      if (!mounted || !owns(url, controller)) return
      if (preview) {
        thumbnailState.value[url] = { phase: 'ready', src: preview }
        return
      }
      const result = await generateModelThumbnail(
        url,
        filename,
        controller.signal
      )
      if (!mounted || !owns(url, controller)) return
      if (result.status === 'rendered') {
        thumbnailState.value[url] = { phase: 'ready', src: result.dataUrl }
      } else if (result.status === 'failed') {
        scheduleThumbnailRetry(url, filename, 0)
      }
      // 'cancelled' leaves no entry here — hideThumbnail already removed it
      // synchronously when the abort was issued.
    })
    .catch((error) => {
      if (mounted && owns(url, controller)) {
        scheduleThumbnailRetry(url, filename, 0)
      }
      reportError(error, {
        errorType: 'agent_reply_asset_preview_failure'
      })
    })
}

/**
 * A `failed` render may be a transient 15s deadline expiry rather than a
 * genuinely unrenderable model, so it gets a bounded retry instead of
 * pinning the box icon for the message's lifetime. Deliberately does not
 * check visibility when the retry fires: declining on hidden would strand
 * a url in `gaveUp` with its budget already spent (permanently iconless)
 * -- the exact bug this guards against. The cost of always spending the
 * retry is at most one render for a tile the user may have hidden, which
 * the next `setVisible(url, false)` aborts.
 */
function scheduleThumbnailRetry(
  url: string,
  filename: string,
  attempts: number
): void {
  if (attempts >= MAX_THUMBNAIL_RETRY_ATTEMPTS) {
    thumbnailState.value[url] = { phase: 'gaveUp', attempts }
    return
  }
  const timeout = setTimeout(() => {
    refreshTimeouts.delete(timeout)
    if (!mounted) return
    loadModelThumbnail(url, filename)
  }, THUMBNAIL_RETRY_DELAY_MS)
  refreshTimeouts.add(timeout)
  thumbnailState.value[url] = { phase: 'gaveUp', attempts: attempts + 1 }
}

/**
 * Called from the visibility watcher below when a 3D asset leaves
 * `visibleVisual` ("Show less", or the message re-rendering with fewer
 * assets). Aborts its in-flight render (if any) and drops the entry,
 * freeing the shared render queue instead of leaving it running hidden.
 */
function hideThumbnail(url: string): void {
  const state = thumbnailState.value[url]
  if (state?.phase === 'loading') state.controller.abort()
  delete thumbnailState.value[url]
}

/**
 * Called when a 3D asset is (re)visible. Starts a fresh load unless one is
 * already in flight, ready, or has spent its retry budget — so Show more
 * -> Show less -> Show more restarts a hidden render rather than leaving
 * the tile permanently blank.
 */
function showThumbnail(url: string, filename: string): void {
  if (!thumbnailState.value[url]) loadModelThumbnail(url, filename)
}

watch(
  () => [
    ...visibleVisual.value.filter((asset) => asset.kind === '3D'),
    ...visibleAudio.value
  ],
  (lookups) => {
    if (!isAssetPreviewSupported()) return
    const visible3D = lookups.filter((asset) => asset.kind === '3D')
    const visibleUrls = new Set(visible3D.map((asset) => asset.url))
    for (const url of Object.keys(thumbnailState.value)) {
      if (!visibleUrls.has(url)) hideThumbnail(url)
    }
    for (const { url, filename } of visible3D) {
      showThumbnail(url, filename)
    }
    for (const { url, filename } of lookups) {
      if (!(url in assetNames.value)) {
        assetNames.value[url] = ''
        void findOutputAsset(filename)
          .then((record) => {
            if (mounted && record?.name) assetNames.value[url] = record.name
          })
          .catch(() => {})
      }
    }
  },
  { immediate: true }
)

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)
const MediaLightbox = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/queue/MediaLightbox.vue')
)

function refreshModelThumbnail(asset: ReplyAsset, retry = true): void {
  const state = thumbnailState.value[asset.url]
  if (!mounted || !isAssetPreviewSupported() || state?.phase === 'ready')
    return
  void findServerPreviewUrl(asset.filename)
    .then((preview) => {
      if (!mounted) return
      if (preview) {
        // Overwriting a `loading` entry here would drop its controller
        // unreachable, so neither unmount nor the watcher could ever abort
        // it. Abort first.
        const current = thumbnailState.value[asset.url]
        if (current?.phase === 'loading') current.controller.abort()
        thumbnailState.value[asset.url] = { phase: 'ready', src: preview }
      } else if (retry) {
        const timeout = setTimeout(() => {
          refreshTimeouts.delete(timeout)
          refreshModelThumbnail(asset, false)
        }, 2000)
        refreshTimeouts.add(timeout)
      }
    })
    .catch((error) => {
      reportError(error, { errorType: 'agent_reply_asset_preview_failure' })
    })
}

function modelThumbnailSrc(url: string): string {
  const state = thumbnailState.value[url]
  return state?.phase === 'ready' ? state.src : ''
}

function inspect(asset: ReplyAsset): void {
  if (asset.kind === '3D') {
    useDialogStore().showDialog({
      key: 'asset-3d-viewer',
      title: assetNames.value[asset.url] || asset.filename,
      component: Load3dViewerContent,
      props: { modelUrl: asset.url },
      dialogComponentProps: {
        renderer: 'reka',
        size: 'full',
        contentClass: 'left-1/2 w-[80vw] sm:max-w-[80vw] h-[80vh] max-h-[80vh]',
        maximizable: true,
        onClose: () => refreshModelThumbnail(asset)
      }
    })
    return
  }
  galleryIndex.value = galleryAssets.value.indexOf(asset)
}

function playPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) void video.play().catch(() => {})
}

function stopPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) video.pause()
}
</script>

<template>
  <div class="my-4 flex flex-col gap-2">
    <div v-if="visibleVisual.length" :class="cn('grid gap-1', gridColsClass)">
      <button
        v-for="asset in visibleVisual"
        :key="asset.url"
        type="button"
        :aria-label="asset.label ?? asset.filename"
        :class="
          cn(
            'relative cursor-pointer overflow-hidden rounded-lg border-none p-0',
            multi && 'bg-agent-surface-hover aspect-square',
            !multi && asset.kind === '3D' && 'justify-self-end'
          )
        "
        @click="inspect(asset)"
      >
        <img
          v-if="asset.kind === 'image'"
          :src="asset.url"
          :alt="asset.label ?? asset.filename"
          loading="lazy"
          :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
        />
        <video
          v-else-if="asset.kind === 'video'"
          :src="asset.url"
          data-testid="reply-video-preview"
          muted
          loop
          playsinline
          preload="metadata"
          :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
          @mouseenter="playPreview"
          @mouseleave="stopPreview"
        />
        <img
          v-else-if="modelThumbnailSrc(asset.url)"
          :src="modelThumbnailSrc(asset.url)"
          :alt="asset.label ?? asset.filename"
          loading="lazy"
          :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
        />
        <span
          v-else
          :class="
            cn(
              'flex items-center justify-center',
              multi ? 'size-full' : 'bg-agent-surface-hover aspect-square w-40'
            )
          "
        >
          <span class="text-agent-fg-muted icon-[lucide--box] size-6" />
        </span>
      </button>
    </div>

    <button
      v-if="collapsible"
      type="button"
      class="border-agent-border text-agent-fg hover:bg-agent-surface-hover flex cursor-pointer items-center gap-1 self-center rounded-full border px-3 py-1 text-xs"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('agent.showLess') : t('agent.showMore') }}
      <span
        :class="
          cn('icon-[lucide--chevron-down] size-3', expanded && 'rotate-180')
        "
      />
    </button>

    <div v-if="audio.length" class="flex flex-col gap-1">
      <ReplyAudioCard
        v-for="asset in visibleAudio"
        :key="asset.url"
        :asset
        :title="assetNames[asset.url] || asset.filename"
      />
      <button
        v-if="audioCollapsible"
        type="button"
        class="border-agent-border text-agent-fg hover:bg-agent-surface-hover flex cursor-pointer items-center gap-1 self-center rounded-full border px-3 py-1 text-xs"
        @click="audioExpanded = !audioExpanded"
      >
        {{ audioExpanded ? t('agent.showLess') : t('agent.showMore') }}
        <span
          :class="
            cn(
              'icon-[lucide--chevron-down] size-3',
              audioExpanded && 'rotate-180'
            )
          "
        />
      </button>
    </div>

    <MediaLightbox
      v-if="galleryIndex !== -1"
      :all-gallery-items="galleryItems"
      :active-index="galleryIndex"
      @update:active-index="galleryIndex = $event"
    />
  </div>
</template>
