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
      <CardTop ratio="square">
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
            @view="emit('view', $event)"
            @download="emit('download', $event)"
            @copy="emit('copy', $event)"
            @more="emit('more', $event)"
            @copy-job-id="emit('copyJobId', $event)"
            @play="emit('play', $event)"
            @video-playing-state-changed="isVideoPlaying = $event"
          />
        </template>
        <template v-if="asset?.duration" #bottom-left>
          <div :class="durationChipClasses">
            <SquareChip variant="light" :label="formattedDuration" />
          </div>
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
import { computed, ref } from 'vue'

import Media3DBottom from '@/components/assetLibrary/cards/Media3DBottom.vue'
import Media3DTop from '@/components/assetLibrary/cards/Media3DTop.vue'
import MediaAudioBottom from '@/components/assetLibrary/cards/MediaAudioBottom.vue'
import MediaAudioTop from '@/components/assetLibrary/cards/MediaAudioTop.vue'
import MediaImageBottom from '@/components/assetLibrary/cards/MediaImageBottom.vue'
import MediaImageTop from '@/components/assetLibrary/cards/MediaImageTop.vue'
import MediaVideoBottom from '@/components/assetLibrary/cards/MediaVideoBottom.vue'
import MediaVideoTop from '@/components/assetLibrary/cards/MediaVideoTop.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import type { AssetContext, AssetMeta, MediaKind } from '@/types/media.types'
import { cn } from '@/utils/tailwindUtil'

import { formatDuration } from '../../utils/formatUtil'
import SquareChip from '../chip/SquareChip.vue'

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

// State for video playing
const isVideoPlaying = ref(false)

const emit = defineEmits<{
  download: [assetId: string]
  copyJobId: [jobId: string]
  openDetail: [assetId: string]
  play: [assetId: string]
  view: [assetId: string]
  copy: [assetId: string]
  more: [assetId: string]
  select: [asset: AssetMeta]
}>()

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

const durationChipClasses = computed(() => {
  if (asset?.kind === 'audio') {
    return '-translate-y-11'
  }
  if (asset?.kind === 'video' && isVideoPlaying.value) {
    return '-translate-y-16'
  }
  return ''
})

const handleCardClick = () => {
  if (asset) {
    emit('select', asset)
  }
}
</script>
