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
            @view="actions.onView"
            @download="actions.onDownload"
            @play="actions.onPlay"
            @video-playing-state-changed="isVideoPlaying = $event"
            @video-controls-changed="showVideoControls = $event"
          />
        </template>

        <!-- Actions overlay (top-left) - show on hover or when menu is open, but not when video is playing -->
        <template v-if="showActionsOverlay" #top-left>
          <MediaAssetActions @menu-state-changed="isMenuOpen = $event" />
        </template>

        <!-- Zoom button (top-right) - show on hover, but not when video is playing -->
        <template v-if="showZoomOverlay" #top-right>
          <IconButton size="sm" @click="actions.onView(asset!.id)">
            <i class="icon-[lucide--zoom-in] size-4" />
          </IconButton>
        </template>

        <!-- Duration/Format chips (bottom-left) - hide when video is playing -->
        <template v-if="showDurationChips" #bottom-left>
          <SquareChip variant="light" :label="formattedDuration" />
          <SquareChip v-if="fileFormat" variant="light" :label="fileFormat" />
        </template>

        <!-- Output count (bottom-right) - hide when video is playing -->
        <template v-if="showOutputCount" #bottom-right>
          <IconTextButton
            type="secondary"
            size="sm"
            :label="context?.outputCount?.toString() ?? '0'"
            @click="actions.onOutputCountClick(asset?.id || '')"
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
import type { AssetContext, AssetMeta, MediaKind } from '../types'
import { MediaAssetKey } from '../types'
import MediaAssetActions from './cards/MediaAssetActions.vue'

const mediaComponents = {
  top: {
    video: defineAsyncComponent(() => import('./cards/MediaVideoTop.vue')),
    audio: defineAsyncComponent(() => import('./cards/MediaAudioTop.vue')),
    image: defineAsyncComponent(() => import('./cards/MediaImageTop.vue')),
    '3D': defineAsyncComponent(() => import('./cards/Media3DTop.vue'))
  },
  bottom: {
    video: defineAsyncComponent(() => import('./cards/MediaVideoBottom.vue')),
    audio: defineAsyncComponent(() => import('./cards/MediaAudioBottom.vue')),
    image: defineAsyncComponent(() => import('./cards/MediaImageBottom.vue')),
    '3D': defineAsyncComponent(() => import('./cards/Media3DBottom.vue'))
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

const emit = defineEmits<{
  select: [asset: AssetMeta]
  view: [assetId: string]
  download: [assetId: string]
  delete: [assetId: string]
  play: [assetId: string]
}>()

const cardContainerRef = ref<HTMLElement>()

const isVideoPlaying = ref(false)
const isMenuOpen = ref(false)
const showVideoControls = ref(false)

const isHovered = useElementHover(cardContainerRef)

const actions = useMediaAssetActions(emit)

provide(MediaAssetKey, {
  asset: toRef(() => asset),
  context: toRef(() => context),
  isVideoPlaying,
  showVideoControls,
  actions
})

const containerClasses = computed(() => {
  return cn(
    'gap-1',
    selected
      ? 'border-3 border-zinc-900 dark-theme:border-white bg-zinc-200 dark-theme:bg-zinc-700'
      : 'hover:bg-zinc-100 dark-theme:hover:bg-zinc-800'
  )
})

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

const showHoverActions = computed(() => {
  return !loading && !!asset && (isHovered.value || isMenuOpen.value)
})

const showZoomButton = computed(() => {
  return asset?.kind === 'image' || asset?.kind === '3D'
})

const showActionsOverlay = computed(() => {
  return showHoverActions.value && !isVideoPlaying.value
})

const showZoomOverlay = computed(() => {
  return showHoverActions.value && showZoomButton.value && !isVideoPlaying.value
})

const showDurationChips = computed(() => {
  return !loading && asset?.duration && !isVideoPlaying.value
})

const showOutputCount = computed(() => {
  return !loading && context?.outputCount && !isVideoPlaying.value
})

const handleCardClick = () => {
  if (asset) {
    actions.onSelect(asset)
  }
}
</script>
