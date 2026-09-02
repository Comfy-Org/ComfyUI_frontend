<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
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

const modelThumbnails = ref<Record<string, string>>({})
const assetNames = ref<Record<string, string>>({})
const refreshTimeouts = new Set<ReturnType<typeof setTimeout>>()
const retriedThumbnails = new Set<string>()
const thumbnailAborts = new Map<string, AbortController>()
let mounted = true
onBeforeUnmount(() => {
  mounted = false
  for (const controller of thumbnailAborts.values()) controller.abort()
  thumbnailAborts.clear()
  for (const timeout of refreshTimeouts) clearTimeout(timeout)
  refreshTimeouts.clear()
})

/**
 * Look up a server-rendered preview, falling back to an offscreen render.
 *
 * The placeholder is what stops the watcher re-entering, so both giving-up
 * paths clear it deliberately: a cancelled render was never attempted and
 * is retried whenever the tile comes back on screen, while a failed one
 * gets a single retry, because `failed` also covers a transient deadline.
 */
function loadModelThumbnail(url: string, filename: string): void {
  modelThumbnails.value[url] = ''
  const controller = new AbortController()
  thumbnailAborts.set(url, controller)
  void findServerPreviewUrl(filename)
    .then(async (preview) => {
      if (!mounted) return
      if (preview) {
        modelThumbnails.value[url] = preview
        return
      }
      const result = await generateModelThumbnail(
        url,
        filename,
        controller.signal
      )
      if (!mounted) return
      if (result.status === 'rendered') {
        modelThumbnails.value[url] = result.dataUrl
      } else if (result.status === 'cancelled') {
        delete modelThumbnails.value[url]
      } else if (!retriedThumbnails.has(url)) {
        retriedThumbnails.add(url)
        delete modelThumbnails.value[url]
      }
    })
    .catch((error) => {
      if (mounted) delete modelThumbnails.value[url]
      reportError(error, {
        errorType: 'agent_reply_asset_preview_failure'
      })
    })
    .finally(() => {
      if (thumbnailAborts.get(url) === controller) thumbnailAborts.delete(url)
    })
}

watch(
  () => [
    ...visibleVisual.value.filter((asset) => asset.kind === '3D'),
    ...visibleAudio.value
  ],
  (lookups) => {
    if (!isAssetPreviewSupported()) return
    const onScreen = new Set(lookups.map((asset) => asset.url))
    for (const [url, controller] of thumbnailAborts) {
      if (!onScreen.has(url)) controller.abort()
    }
    for (const { url, filename, kind } of lookups) {
      if (kind === '3D' && !(url in modelThumbnails.value)) {
        loadModelThumbnail(url, filename)
      }
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
  if (
    !mounted ||
    !isAssetPreviewSupported() ||
    modelThumbnails.value[asset.url]
  )
    return
  void findServerPreviewUrl(asset.filename)
    .then((preview) => {
      if (!mounted) return
      if (preview) {
        modelThumbnails.value[asset.url] = preview
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
          v-else-if="modelThumbnails[asset.url]"
          :src="modelThumbnails[asset.url]"
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
