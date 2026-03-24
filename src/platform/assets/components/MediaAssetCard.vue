<template>
  <div
    ref="cardContainerRef"
    role="button"
    :aria-label="
      asset
        ? $t('assetBrowser.ariaLabel.assetCard', {
            name: getAssetDisplayName(asset),
            type: fileKind
          })
        : $t('assetBrowser.ariaLabel.loadingAsset')
    "
    :tabindex="loading ? -1 : 0"
    :class="
      cn(
        'flex cursor-pointer flex-col overflow-hidden rounded-lg p-2 transition-colors duration-200',
        'group gap-2 select-none',
        selected
          ? 'ring-3 ring-modal-card-border-highlighted ring-inset'
          : 'hover:bg-modal-card-background-hovered/20'
      )
    "
    :data-selected="selected"
    :draggable="true"
    @click.stop="$emit('click')"
    @contextmenu.prevent.stop="
      asset ? emit('context-menu', $event, asset) : undefined
    "
    @dragstart="dragStart"
  >
    <!-- Top Area: Media Preview -->
    <div class="relative aspect-square overflow-hidden p-0">
      <!-- Loading State -->
      <div
        v-if="loading"
        class="size-full animate-pulse rounded-lg bg-modal-card-placeholder-background"
      />

      <!-- Content based on asset type -->
      <component
        :is="getTopComponent(previewKind)"
        v-else-if="asset && adaptedAsset"
        :asset="adaptedAsset"
        :context="{ type: assetType }"
        class="absolute inset-0"
        @view="handleZoomClick"
        @download="actions.downloadAsset()"
        @video-playing-state-changed="isVideoPlaying = $event"
        @video-controls-changed="showVideoControls = $event"
        @image-loaded="handleImageLoaded"
      />

      <LoadingOverlay :loading="isDeleting">
        <i class="icon-[lucide--trash-2] size-5" />
      </LoadingOverlay>

      <!-- Action buttons overlay (top-left) -->
      <div
        v-if="showActionsOverlay"
        class="absolute top-2 left-2 flex flex-wrap justify-start gap-2"
      >
        <IconGroup background-class="bg-white">
          <Button
            v-if="canInspect"
            variant="overlay-white"
            size="icon"
            :aria-label="$t('mediaAsset.actions.zoom')"
            @click.stop="handleZoomClick"
          >
            <i class="icon-[lucide--zoom-in] size-4" />
          </Button>
          <Button
            variant="overlay-white"
            size="icon"
            :aria-label="$t('mediaAsset.actions.moreOptions')"
            @click.stop="
              asset ? emit('context-menu', $event, asset) : undefined
            "
          >
            <i class="icon-[lucide--ellipsis] size-4" />
          </Button>
        </IconGroup>
      </div>
    </div>

    <!-- Bottom Area: Media Info -->
    <div class="flex-1">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-start justify-between">
        <div class="flex flex-col gap-1">
          <div
            class="h-4 w-24 animate-pulse rounded-sm bg-modal-card-background"
          />
          <div
            class="h-3 w-20 animate-pulse rounded-sm bg-modal-card-background"
          />
        </div>
        <div
          class="h-6 w-12 animate-pulse rounded-sm bg-modal-card-background"
        />
      </div>

      <!-- Content -->
      <div
        v-else-if="asset && adaptedAsset"
        class="flex items-end justify-between gap-1.5"
      >
        <!-- Left side: Media name and metadata -->
        <div class="flex flex-col gap-1">
          <!-- Title -->
          <MediaTitle :file-name="fileName" />
          <!-- Metadata -->
          <div class="flex gap-1.5 text-xs text-muted-foreground">
            <span v-if="formattedDuration">{{ formattedDuration }}</span>
            <span v-if="metaInfo">{{ metaInfo }}</span>
          </div>
        </div>

        <!-- Right side: Output count -->
        <div v-if="showOutputCount" class="shrink-0">
          <Button
            v-tooltip.top.pt:pointer-events-none="
              $t('mediaAsset.actions.seeMoreOutputs')
            "
            variant="secondary"
            @click.stop="handleOutputCountClick"
          >
            <i class="icon-[lucide--layers] size-4" />
            <span>{{ outputCount }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { computed, defineAsyncComponent, provide, ref, toRef } from 'vue'

import IconGroup from '@/components/button/IconGroup.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAssetsStore } from '@/stores/assetsStore'
import {
  formatDuration,
  formatSize,
  getFilenameDetails,
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

import { getAssetType } from '../composables/media/assetMappers'
import { getAssetUrl } from '../utils/assetUrlUtil'
import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import { getAssetDisplayName } from '../utils/assetMetadataUtils'
import type { MediaKind } from '../schemas/mediaAssetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaTitle from './MediaTitle.vue'

type PreviewKind = ReturnType<typeof getMediaTypeFromFilename>

const mediaComponents = {
  top: {
    video: defineAsyncComponent(() => import('./MediaVideoTop.vue')),
    audio: defineAsyncComponent(() => import('./MediaAudioTop.vue')),
    image: defineAsyncComponent(() => import('./MediaImageTop.vue')),
    '3D': defineAsyncComponent(() => import('./Media3DTop.vue')),
    text: defineAsyncComponent(() => import('./MediaTextTop.vue')),
    other: defineAsyncComponent(() => import('./MediaOtherTop.vue'))
  }
}

function getTopComponent(kind: PreviewKind) {
  return mediaComponents.top[kind] || mediaComponents.top.other
}

const { asset, loading, selected, showOutputCount, outputCount } = defineProps<{
  asset?: AssetItem
  loading?: boolean
  selected?: boolean
  showOutputCount?: boolean
  outputCount?: number
}>()

const assetsStore = useAssetsStore()

// Get deletion state from store
const isDeleting = computed(() =>
  asset ? assetsStore.isAssetDeleting(asset.id) : false
)

const emit = defineEmits<{
  click: []
  zoom: [asset: AssetItem]
  'output-count-click': []
  'context-menu': [event: MouseEvent, asset: AssetItem]
}>()

const cardContainerRef = ref<HTMLElement>()

const isVideoPlaying = ref(false)
const showVideoControls = ref(false)

// Store actual image dimensions
const imageDimensions = ref<{ width: number; height: number } | undefined>()

const isHovered = useElementHover(cardContainerRef)

const actions = useMediaAssetActions()

// Get asset type from tags
const assetType = computed(() => {
  return getAssetType(asset?.tags)
})

// Determine file type from extension
const fileKind = computed((): MediaKind => {
  return getMediaTypeFromFilename(asset?.name || '')
})

const previewKind = computed((): PreviewKind => {
  return getMediaTypeFromFilename(asset?.name || '')
})

const canInspect = computed(() => isPreviewableMediaType(fileKind.value))

// Get filename without extension
const fileName = computed(() => {
  return getFilenameDetails(asset ? getAssetDisplayName(asset) : '').filename
})

// Adapt AssetItem to legacy AssetMeta format for existing components
const adaptedAsset = computed(() => {
  if (!asset) return undefined
  return {
    id: asset.id,
    name: asset.name,
    display_name: asset.display_name,
    kind: fileKind.value,
    src:
      fileKind.value === '3D'
        ? getAssetUrl(asset)
        : asset.thumbnail_url || asset.preview_url || '',
    preview_url: asset.preview_url,
    preview_id: asset.preview_id,
    size: asset.size,
    tags: asset.tags || [],
    created_at: asset.created_at,
    duration: asset.user_metadata?.duration
      ? Number(asset.user_metadata.duration)
      : undefined,
    dimensions: imageDimensions.value
  }
})

provide(MediaAssetKey, {
  asset: toRef(() => adaptedAsset.value),
  context: toRef(() => ({ type: assetType.value })),
  isVideoPlaying,
  showVideoControls
})

const formattedDuration = computed(() => {
  // Check for execution time first (from history API)
  const executionTime = asset?.user_metadata?.executionTimeInSeconds
  if (executionTime !== undefined && executionTime !== null) {
    return `${Number(executionTime).toFixed(2)}s`
  }

  // Fall back to duration for media files
  const duration = asset?.user_metadata?.duration
  if (!duration) return ''
  return formatDuration(Number(duration))
})

// Get metadata info based on file kind
const metaInfo = computed(() => {
  if (!asset) return ''
  if (fileKind.value === 'image' && imageDimensions.value) {
    return `${imageDimensions.value.width}x${imageDimensions.value.height}`
  }
  if (asset.size && ['video', 'audio', '3D'].includes(fileKind.value)) {
    return formatSize(asset.size)
  }
  return ''
})

const showActionsOverlay = computed(() => {
  if (loading || !asset || isDeleting.value) return false
  return isHovered.value || selected || isVideoPlaying.value
})

const handleZoomClick = () => {
  if (asset && canInspect.value) {
    emit('zoom', asset)
  }
}

const handleImageLoaded = (width: number, height: number) => {
  imageDimensions.value = { width, height }
}

const handleOutputCountClick = () => {
  emit('output-count-click')
}
function dragStart(e: DragEvent) {
  if (!asset?.preview_url) return

  const { dataTransfer } = e
  if (!dataTransfer) return

  const url = URL.parse(asset.preview_url, location.href)
  if (!url) return

  dataTransfer.items.add(url.toString(), 'text/uri-list')
}
</script>
