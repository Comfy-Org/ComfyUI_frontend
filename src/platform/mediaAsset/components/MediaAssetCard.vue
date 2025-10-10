<template>
  <CardContainer
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
          />
        </template>

        <!-- Actions overlay (top-left) -->
        <template v-if="!loading && asset" #top-left>
          <MediaAssetActions />
        </template>

        <!-- Zoom button (top-right) -->
        <template v-if="!loading && asset && showZoomButton" #top-right>
          <IconButton size="sm" @click="actions.onView(asset.id)">
            <i class="icon-[lucide--zoom-in] size-4" />
          </IconButton>
        </template>

        <!-- Duration/Format chips (bottom-left) -->
        <template v-if="!loading && asset?.duration" #bottom-left>
          <SquareChip variant="light" :label="formattedDuration" />
          <SquareChip v-if="fileFormat" variant="light" :label="fileFormat" />
        </template>

        <!-- Output count (bottom-right) -->
        <template v-if="!loading && context?.outputCount" #bottom-right>
          <IconTextButton
            type="secondary"
            size="sm"
            :label="context.outputCount.toString()"
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
import { computed, provide, ref, toRef } from 'vue'

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
import Media3DBottom from './cards/Media3DBottom.vue'
import Media3DTop from './cards/Media3DTop.vue'
import MediaAssetActions from './cards/MediaAssetActions.vue'
import MediaAudioBottom from './cards/MediaAudioBottom.vue'
import MediaAudioTop from './cards/MediaAudioTop.vue'
import MediaImageBottom from './cards/MediaImageBottom.vue'
import MediaImageTop from './cards/MediaImageTop.vue'
import MediaVideoBottom from './cards/MediaVideoBottom.vue'
import MediaVideoTop from './cards/MediaVideoTop.vue'

// Map media types to their specific top components
const topComponents = {
  video: MediaVideoTop,
  audio: MediaAudioTop,
  image: MediaImageTop,
  '3D': Media3DTop
}

// Map media types to their specific bottom components
const bottomComponents = {
  video: MediaVideoBottom,
  audio: MediaAudioBottom,
  image: MediaImageBottom,
  '3D': Media3DBottom
}

function getTopComponent(kind: MediaKind) {
  return topComponents[kind] || MediaImageTop
}

function getBottomComponent(kind: MediaKind) {
  return bottomComponents[kind] || MediaImageBottom
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

// State for video playing
const isVideoPlaying = ref(false)

// Create actions using composable
const actions = useMediaAssetActions(emit)

// Provide for child components
provide(MediaAssetKey, {
  asset: toRef(() => asset),
  context: toRef(() => context),
  isVideoPlaying,
  actions
})

// Computed properties
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
  if (asset?.kind === 'video' && isVideoPlaying.value) {
    return '-translate-y-16'
  }
  return ''
})

const showZoomButton = computed(() => {
  return asset?.kind === 'image' || asset?.kind === '3D'
})

const handleCardClick = () => {
  if (asset) {
    actions.onSelect(asset)
  }
}
</script>
