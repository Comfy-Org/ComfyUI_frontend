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

import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/components/load3d/load3dViewerDialog'
import type { ModelThumbnailResult } from '@/components/load3d/modelThumbnail'
import { generateModelThumbnail } from '@/components/load3d/modelThumbnail'
import Button from '@/components/ui/button/Button.vue'
import {
  findOutputAsset,
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  ReplyAsset,
  ReplyVisualAsset as ReplyVisualAssetData
} from '../../../utils/replyAssets'
import {
  isReplyAudioAsset,
  isReplyVisualAsset,
  replyAssetResultItem
} from '../../../utils/replyAssets'
import ReplyAudioAssetGroup from './ReplyAudioAssetGroup.vue'
import ReplyVisualAsset from './ReplyVisualAsset.vue'

const { assets } = defineProps<{ assets: ReplyAsset[] }>()

const { t } = useI18n()

/* Three rows of the four-column grid, per DES-530. */
const COLLAPSED_COUNT = 12

const visual = computed(() => assets.filter(isReplyVisualAsset))
const audio = computed(() => assets.filter(isReplyAudioAsset))

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

// Preserve controller identity inside Vue's deeply reactive state record.
type ThumbnailState =
  | {
      phase: 'loading'
      controller: AbortController
      attempts: number
      busyAttempts: number
    }
  | {
      phase: 'retryPending'
      timeout: ReturnType<typeof setTimeout>
      attempts: number
      busyAttempts: number
    }
  | { phase: 'paused'; attempts: number; busyAttempts: number }
  | { phase: 'ready'; src: string }
  | { phase: 'gaveUp' }

type ThumbnailLoadOptions = {
  attempts?: number
  busyAttempts?: number
  checkServerPreview?: boolean
  generateOnPreviewMiss?: boolean
}

type ActiveThumbnailLoad = {
  url: string
  filename: string
  controller: AbortController
  attempts: number
  busyAttempts: number
  generateOnPreviewMiss: boolean
}

const MAX_THUMBNAIL_RETRIES = 2
const THUMBNAIL_RETRY_DELAY_MS = 2000
const MAX_THUMBNAIL_BUSY_RETRIES = 9
const MAX_THUMBNAIL_BUSY_DELAY_MS = 8 * 60_000

const thumbnailState = ref<Record<string, ThumbnailState>>({})
const assetNames = ref<Record<string, string>>({})
let mounted = true

function cancelThumbnailState(state: ThumbnailState | undefined): void {
  if (state?.phase === 'loading') {
    state.controller.abort()
  } else if (state?.phase === 'retryPending') {
    clearTimeout(state.timeout)
  }
}

onBeforeUnmount(() => {
  mounted = false
  for (const state of Object.values(thumbnailState.value)) {
    cancelThumbnailState(state)
  }
})

/**
 * Whether an offscreen render can resolve `url` at all. The Load3D loader
 * resolves model data through the `filename` query, so a URL without one is
 * terminally unrenderable rather than transiently failing — retrying it would
 * spend the whole budget on work that cannot succeed.
 */
function canRenderOffscreen(url: string): boolean {
  return new URL(url, window.location.origin).searchParams.has('filename')
}

/** Whether `url`'s current entry is still the `loading` strand owned by `controller`. */
function owns(url: string, controller: AbortController): boolean {
  const state = thumbnailState.value[url]
  return state?.phase === 'loading' && state.controller === controller
}

function loadModelThumbnail(
  url: string,
  filename: string,
  {
    attempts = 0,
    busyAttempts = 0,
    checkServerPreview = true,
    generateOnPreviewMiss = true
  }: ThumbnailLoadOptions = {}
): void {
  const controller = markRaw(new AbortController())
  thumbnailState.value[url] = {
    phase: 'loading',
    controller,
    attempts,
    busyAttempts
  }

  const previewLookup = checkServerPreview
    ? findServerPreviewUrl(filename)
    : Promise.resolve(null)
  void previewLookup
    .then((preview) =>
      handlePreviewLookup(
        {
          url,
          filename,
          controller,
          attempts,
          busyAttempts,
          generateOnPreviewMiss
        },
        preview
      )
    )
    .catch(() => {
      if (!mounted || !owns(url, controller)) return
      scheduleThumbnailRetry(url, filename, attempts, busyAttempts)
    })
}

async function handlePreviewLookup(
  load: ActiveThumbnailLoad,
  preview: string | null
): Promise<void> {
  const { url, filename, controller, attempts, busyAttempts } = load
  if (!mounted || !owns(url, controller)) return
  if (preview) {
    thumbnailState.value[url] = { phase: 'ready', src: preview }
    return
  }
  if (!load.generateOnPreviewMiss) {
    scheduleThumbnailLoad(url, filename, {
      attempts,
      busyAttempts,
      delay: THUMBNAIL_RETRY_DELAY_MS
    })
    return
  }
  if (!canRenderOffscreen(url)) {
    thumbnailState.value[url] = { phase: 'gaveUp' }
    return
  }
  const result = await generateModelThumbnail(url, filename, controller.signal)
  if (!mounted || !owns(url, controller)) return
  publishThumbnailResult(load, result)
}

function publishThumbnailResult(
  load: ActiveThumbnailLoad,
  result: ModelThumbnailResult
): void {
  const { url, filename, attempts, busyAttempts } = load
  if (result.status === 'rendered') {
    thumbnailState.value[url] = { phase: 'ready', src: result.dataUrl }
  } else if (result.status === 'failed' || result.status === 'busy') {
    scheduleThumbnailRetry(url, filename, attempts, busyAttempts, result.status)
  } else {
    thumbnailState.value[url] = { phase: 'gaveUp' }
  }
}

function scheduleThumbnailLoad(
  url: string,
  filename: string,
  {
    attempts,
    busyAttempts,
    delay,
    checkServerPreview = true
  }: {
    attempts: number
    busyAttempts: number
    delay: number
    checkServerPreview?: boolean
  }
): void {
  const timeout = setTimeout(() => {
    if (!mounted) return
    loadModelThumbnail(url, filename, {
      attempts,
      busyAttempts,
      checkServerPreview
    })
  }, delay)
  thumbnailState.value[url] = {
    phase: 'retryPending',
    timeout: markRaw(timeout),
    attempts,
    busyAttempts
  }
}

function scheduleThumbnailRetry(
  url: string,
  filename: string,
  attempts: number,
  busyAttempts = 0,
  status: 'failed' | 'busy' = 'failed'
): void {
  if (
    (status === 'failed' && attempts >= MAX_THUMBNAIL_RETRIES) ||
    (status === 'busy' && busyAttempts >= MAX_THUMBNAIL_BUSY_RETRIES)
  ) {
    thumbnailState.value[url] = { phase: 'gaveUp' }
    return
  }
  const nextAttempts = status === 'failed' ? attempts + 1 : attempts
  const nextBusyAttempts = status === 'busy' ? busyAttempts + 1 : busyAttempts
  const delay =
    status === 'busy'
      ? Math.min(
          THUMBNAIL_RETRY_DELAY_MS * 2 ** busyAttempts,
          MAX_THUMBNAIL_BUSY_DELAY_MS
        )
      : THUMBNAIL_RETRY_DELAY_MS
  scheduleThumbnailLoad(url, filename, {
    attempts: nextAttempts,
    busyAttempts: nextBusyAttempts,
    delay,
    checkServerPreview: status !== 'busy'
  })
}

function hideThumbnail(url: string): void {
  const state = thumbnailState.value[url]
  if (state?.phase === 'ready' || state?.phase === 'gaveUp') return
  cancelThumbnailState(state)
  thumbnailState.value[url] = {
    phase: 'paused',
    attempts: state && 'attempts' in state ? state.attempts : 0,
    busyAttempts: state && 'busyAttempts' in state ? state.busyAttempts : 0
  }
}

function showThumbnail(url: string, filename: string): void {
  const state = thumbnailState.value[url]
  if (!state) loadModelThumbnail(url, filename)
  else if (state.phase === 'paused') {
    loadModelThumbnail(url, filename, {
      attempts: state.attempts,
      busyAttempts: state.busyAttempts
    })
  }
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

function refreshModelThumbnail(asset: ReplyAsset): void {
  const state = thumbnailState.value[asset.url]
  if (!mounted || !isAssetPreviewSupported() || state?.phase === 'ready') return
  cancelThumbnailState(state)
  loadModelThumbnail(asset.url, asset.filename, {
    generateOnPreviewMiss: false
  })
}

function modelThumbnailSrc(url: string): string {
  const state = thumbnailState.value[url]
  return state?.phase === 'ready' ? state.src : ''
}

function inspect(asset: ReplyVisualAssetData): void {
  if (asset.kind === '3D') {
    useDialogStore().showDialog({
      key: 'asset-3d-viewer',
      title: assetNames.value[asset.url] || asset.label || asset.filename,
      component: Load3dViewerContent,
      props: { modelUrl: asset.url },
      dialogComponentProps: {
        ...LOAD3D_VIEWER_DIALOG_PROPS,
        onClose: () => refreshModelThumbnail(asset)
      }
    })
    return
  }
  galleryIndex.value = galleryAssets.value.indexOf(asset)
}
</script>

<template>
  <div data-testid="reply-asset-group" class="my-4 flex flex-col gap-2">
    <div v-if="visibleVisual.length" :class="cn('grid gap-1', gridColsClass)">
      <ReplyVisualAsset
        v-for="asset in visibleVisual"
        :key="asset.url"
        :asset
        :multi
        :model-thumbnail-src="modelThumbnailSrc(asset.url)"
        @inspect="inspect(asset)"
      />
    </div>

    <Button
      v-if="collapsible"
      type="button"
      variant="outline"
      size="sm"
      class="self-center rounded-full border-component-node-border"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('agent.showLess') : t('agent.showMore') }}
      <span
        :class="
          cn('icon-[lucide--chevron-down] size-3', expanded && 'rotate-180')
        "
      />
    </Button>

    <ReplyAudioAssetGroup
      v-if="audio.length"
      :assets="visibleAudio"
      :asset-names
      :collapsible="audioCollapsible"
      :expanded="audioExpanded"
      @toggle="audioExpanded = !audioExpanded"
    />

    <MediaLightbox
      v-if="galleryIndex !== -1"
      :all-gallery-items="galleryItems"
      :active-index="galleryIndex"
      @update:active-index="galleryIndex = $event"
    />
  </div>
</template>
