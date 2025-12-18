<template>
  <CardContainer
    ref="cardContainerRef"
    role="button"
    :aria-label="
      asset
        ? $t('assetBrowser.ariaLabel.assetCard', {
            name: asset.name,
            type: fileKind
          })
        : $t('assetBrowser.ariaLabel.loadingAsset')
    "
    :tabindex="loading ? -1 : 0"
    size="mini"
    variant="ghost"
    rounded="lg"
    :class="containerClasses"
    :data-selected="selected"
    @click.stop="$emit('click')"
    @contextmenu.prevent="handleContextMenu"
  >
    <template #top>
      <CardTop
        ratio="square"
        :bottom-left-class="durationChipClasses"
        :bottom-right-class="durationChipClasses"
      >
        <!-- Loading State -->
        <template v-if="loading">
          <div
            class="size-full animate-pulse rounded-lg bg-modal-card-placeholder-background"
          />
        </template>

        <!-- Content based on asset type -->
        <template v-else-if="asset && adaptedAsset">
          <component
            :is="getTopComponent(fileKind)"
            :asset="adaptedAsset"
            :context="{ type: assetType }"
            @view="handleZoomClick"
            @download="actions.downloadAsset()"
            @video-playing-state-changed="isVideoPlaying = $event"
            @video-controls-changed="showVideoControls = $event"
            @image-loaded="handleImageLoaded"
          />
        </template>

        <!-- Top-left slot: Duration/Format chips OR Media actions -->
        <template #top-left>
          <!-- Duration/Format chips - show when not hovered and not playing -->
          <div v-if="showStaticChips" class="flex flex-wrap items-center gap-1">
            <SquareChip
              v-if="formattedDuration"
              variant="gray"
              :label="formattedDuration"
            />
          </div>

          <!-- Media actions - show on hover or when playing -->
          <IconGroup v-else-if="showActionsOverlay">
            <Button size="icon" @click.stop="handleZoomClick">
              <i class="icon-[lucide--zoom-in] size-4" />
            </Button>
            <Button size="icon" @click.stop="handleContextMenu">
              <i class="icon-[lucide--ellipsis] size-4" />
            </Button>
          </IconGroup>
        </template>

        <!-- Output count (top-right) -->
        <template v-if="showOutputCount" #top-right>
          <IconTextButton
            v-tooltip.top.pt:pointer-events-none="
              $t('mediaAsset.actions.seeMoreOutputs')
            "
            type="secondary"
            size="sm"
            :label="String(outputCount)"
            @click.stop="handleOutputCountClick"
          >
            <template #icon>
              <i class="icon-[lucide--layers] size-4" />
            </template>
          </IconTextButton>
        </template>
      </CardTop>
    </template>

    <template #bottom>
      <CardBottom>
        <!-- Loading State -->
        <template v-if="loading">
          <div class="flex flex-col items-center justify-between gap-1">
            <div
              class="h-4 w-2/3 animate-pulse rounded bg-modal-card-background"
            />
            <div
              class="h-3 w-1/2 animate-pulse rounded bg-modal-card-background"
            />
          </div>
        </template>

        <!-- Content based on asset type -->
        <template v-else-if="asset && adaptedAsset">
          <component
            :is="getBottomComponent(fileKind)"
            :asset="adaptedAsset"
            :context="{ type: assetType }"
          />
        </template>
      </CardBottom>
    </template>
  </CardContainer>

  <MediaAssetContextMenu
    v-if="asset"
    ref="contextMenu"
    :asset="asset"
    :asset-type="assetType"
    :file-kind="fileKind"
    :show-delete-button="showDeleteButton"
    @zoom="handleZoomClick"
    @asset-deleted="emit('asset-deleted')"
  />
</template>

<script setup lang="ts">
import { useElementHover, whenever } from '@vueuse/core'
import { computed, defineAsyncComponent, provide, ref, toRef } from 'vue'

import IconGroup from '@/components/button/IconGroup.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import Button from '@/components/ui/button/Button.vue'
import { formatDuration, getMediaTypeFromFilename } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

import { getAssetType } from '../composables/media/assetMappers'
import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import type { MediaKind } from '../schemas/mediaAssetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetContextMenu from './MediaAssetContextMenu.vue'

const mediaComponents = {
  top: {
    video: defineAsyncComponent(() => import('./MediaVideoTop.vue')),
    audio: defineAsyncComponent(() => import('./MediaAudioTop.vue')),
    image: defineAsyncComponent(() => import('./MediaImageTop.vue')),
    '3D': defineAsyncComponent(() => import('./Media3DTop.vue'))
  },
  bottom: {
    video: defineAsyncComponent(() => import('./MediaVideoBottom.vue')),
    audio: defineAsyncComponent(() => import('./MediaAudioBottom.vue')),
    image: defineAsyncComponent(() => import('./MediaImageBottom.vue')),
    '3D': defineAsyncComponent(() => import('./Media3DBottom.vue'))
  }
}

function getTopComponent(kind: MediaKind) {
  return mediaComponents.top[kind] || mediaComponents.top.image
}

function getBottomComponent(kind: MediaKind) {
  return mediaComponents.bottom[kind] || mediaComponents.bottom.image
}

const {
  asset,
  loading,
  selected,
  showOutputCount,
  outputCount,
  showDeleteButton,
  openContextMenuId
} = defineProps<{
  asset?: AssetItem
  loading?: boolean
  selected?: boolean
  showOutputCount?: boolean
  outputCount?: number
  showDeleteButton?: boolean
  openContextMenuId?: string | null
}>()

const emit = defineEmits<{
  click: []
  zoom: [asset: AssetItem]
  'output-count-click': []
  'asset-deleted': []
  'context-menu-opened': []
}>()

const cardContainerRef = ref<HTMLElement>()
const contextMenu = ref<InstanceType<typeof MediaAssetContextMenu>>()

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
  return getMediaTypeFromFilename(asset?.name || '') as MediaKind
})

// Adapt AssetItem to legacy AssetMeta format for existing components
const adaptedAsset = computed(() => {
  if (!asset) return undefined
  return {
    id: asset.id,
    name: asset.name,
    kind: fileKind.value,
    src: asset.preview_url || '',
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

const containerClasses = computed(() =>
  cn(
    'gap-1 select-none group',
    selected
      ? 'ring-3 ring-inset ring-modal-card-border-highlighted'
      : 'hover:bg-modal-card-background-hovered'
  )
)

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

const durationChipClasses = computed(() => {
  if (fileKind.value === 'audio') {
    return '-translate-y-11'
  }
  if (fileKind.value === 'video' && showVideoControls.value) {
    return '-translate-y-16'
  }
  return ''
})

// Show static chips when NOT hovered and NOT playing (normal state)
const showStaticChips = computed(
  () =>
    !loading &&
    !!asset &&
    !isHovered.value &&
    !isVideoPlaying.value &&
    formattedDuration.value
)

// Show action overlay when hovered OR playing
const showActionsOverlay = computed(
  () => !loading && !!asset && (isHovered.value || isVideoPlaying.value)
)

const handleZoomClick = () => {
  if (asset) {
    emit('zoom', asset)
  }
}

const handleImageLoaded = (width: number, height: number) => {
  imageDimensions.value = { width, height }
}

const handleOutputCountClick = () => {
  emit('output-count-click')
}

const handleContextMenu = (event: MouseEvent) => {
  emit('context-menu-opened')
  contextMenu.value?.show(event)
}

// Close this context menu when another opens
whenever(
  () => openContextMenuId && openContextMenuId !== asset?.id,
  () => {
    contextMenu.value?.hide()
  }
)
</script>
