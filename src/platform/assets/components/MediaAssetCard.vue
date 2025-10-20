<template>
  <CardContainer
    ref="cardContainerRef"
    role="button"
    :aria-label="
      asset ? `${asset.name} - ${asset.kind} asset` : 'Loading asset'
    "
    :tabindex="loading ? -1 : 0"
    size="mini"
    variant="ghost"
    rounded="lg"
    :class="containerClasses"
    @click="handleCardClick"
    @keydown.enter="handleCardClick"
    @keydown.space.prevent="handleCardClick"
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
            class="h-full w-full animate-pulse rounded-lg bg-zinc-200 dark-theme:bg-zinc-700"
          />
        </template>

        <!-- Content based on asset type -->
        <template v-else-if="asset">
          <component
            :is="getTopComponent(asset.kind)"
            :asset="asset"
            :context="context"
            @view="handleZoomClick"
            @download="actions.downloadAsset(asset!.id)"
            @play="actions.playAsset(asset!.id)"
            @video-playing-state-changed="isVideoPlaying = $event"
            @video-controls-changed="showVideoControls = $event"
          />
        </template>

        <!-- Actions overlay (top-left) - show on hover or when menu is open -->
        <template v-if="showActionsOverlay" #top-left>
          <MediaAssetActions
            @menu-state-changed="isMenuOpen = $event"
            @mouseenter="handleOverlayMouseEnter"
            @mouseleave="handleOverlayMouseLeave"
          />
        </template>

        <!-- Zoom button (top-right) - show on hover for all media types -->
        <template v-if="showZoomOverlay" #top-right>
          <IconButton
            size="sm"
            @click.stop="handleZoomClick"
            @mouseenter="handleOverlayMouseEnter"
            @mouseleave="handleOverlayMouseLeave"
          >
            <i class="icon-[lucide--zoom-in] size-4" />
          </IconButton>
        </template>

        <!-- Duration/Format chips (bottom-left) - show on hover even when playing -->
        <template v-if="showDurationChips" #bottom-left>
          <div
            class="flex flex-wrap items-center gap-1"
            @mouseenter="handleOverlayMouseEnter"
            @mouseleave="handleOverlayMouseLeave"
          >
            <SquareChip variant="light" :label="formattedDuration" />
            <SquareChip v-if="fileFormat" variant="light" :label="fileFormat" />
          </div>
        </template>

        <!-- Output count (bottom-right) - show on hover even when playing -->
        <template v-if="showOutputCount" #bottom-right>
          <IconTextButton
            type="secondary"
            size="sm"
            :label="context?.outputCount?.toString() ?? '0'"
            @click.stop="actions.openMoreOutputs(asset?.id || '')"
            @mouseenter="handleOverlayMouseEnter"
            @mouseleave="handleOverlayMouseLeave"
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
              class="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark-theme:bg-zinc-700"
            />
            <div
              class="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark-theme:bg-zinc-700"
            />
          </div>
        </template>

        <!-- Content based on asset type -->
        <template v-else-if="asset">
          <component
            :is="getBottomComponent(asset.kind)"
            :asset="asset"
            :context="context"
          />
        </template>
      </CardBottom>
    </template>
  </CardContainer>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { computed, defineAsyncComponent, provide, ref, toRef } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import { formatDuration } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

import { useMediaAssetActions } from '../composables/useMediaAssetActions'
import { useMediaAssetGalleryStore } from '../composables/useMediaAssetGalleryStore'
import type {
  AssetContext,
  AssetMeta,
  MediaKind
} from '../schemas/mediaAssetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import MediaAssetActions from './MediaAssetActions.vue'

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

const { context, asset, loading, selected } = defineProps<{
  context: AssetContext
  asset?: AssetMeta
  loading?: boolean
  selected?: boolean
}>()

const cardContainerRef = ref<HTMLElement>()

const isVideoPlaying = ref(false)
const isMenuOpen = ref(false)
const showVideoControls = ref(false)
const isOverlayHovered = ref(false)

const isHovered = useElementHover(cardContainerRef)

const actions = useMediaAssetActions()
const galleryStore = useMediaAssetGalleryStore()

provide(MediaAssetKey, {
  asset: toRef(() => asset),
  context: toRef(() => context),
  isVideoPlaying,
  showVideoControls
})

const containerClasses = computed(() =>
  cn(
    'gap-1',
    selected
      ? 'border-3 border-zinc-900 dark-theme:border-white bg-zinc-200 dark-theme:bg-zinc-700'
      : 'hover:bg-zinc-100 dark-theme:hover:bg-zinc-800'
  )
)

const formattedDuration = computed(() => {
  if (!asset?.duration) return ''
  return formatDuration(asset.duration)
})

const fileFormat = computed(() => {
  if (!asset?.name) return ''
  const parts = asset.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
})

const durationChipClasses = computed(() => {
  if (asset?.kind === 'audio') {
    return '-translate-y-11'
  }
  if (asset?.kind === 'video' && showVideoControls.value) {
    return '-translate-y-16'
  }
  return ''
})

const isCardOrOverlayHovered = computed(
  () => isHovered.value || isOverlayHovered.value || isMenuOpen.value
)

const showHoverActions = computed(
  () => !loading && !!asset && isCardOrOverlayHovered.value
)

const showActionsOverlay = computed(
  () =>
    showHoverActions.value &&
    (!isVideoPlaying.value || isCardOrOverlayHovered.value)
)

const showZoomOverlay = computed(
  () =>
    showHoverActions.value &&
    asset?.kind !== '3D' &&
    (!isVideoPlaying.value || isCardOrOverlayHovered.value)
)

const showDurationChips = computed(
  () =>
    !loading &&
    asset?.duration &&
    (!isVideoPlaying.value || isCardOrOverlayHovered.value)
)

const showOutputCount = computed(
  () =>
    !loading &&
    context?.outputCount &&
    (!isVideoPlaying.value || isCardOrOverlayHovered.value)
)

const handleCardClick = () => {
  if (asset) {
    actions.selectAsset(asset)
  }
}

const handleOverlayMouseEnter = () => {
  isOverlayHovered.value = true
}

const handleOverlayMouseLeave = () => {
  isOverlayHovered.value = false
}

const handleZoomClick = () => {
  if (asset) {
    galleryStore.openSingle(asset)
  }
}
</script>
