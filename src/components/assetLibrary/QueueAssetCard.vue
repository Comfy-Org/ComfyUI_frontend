<template>
  <!-- Loading State -->
  <CardContainer
    v-if="loading"
    :ratio="dense ? 'smallSquare' : 'square'"
    type="asset-card"
  >
    <template #top>
      <CardTop ratio="square">
        <div
          class="w-full h-full bg-gray-200 dark-theme:bg-gray-700 animate-pulse"
        />
      </CardTop>
    </template>
    <template #bottom>
      <CardBottom>
        <div class="px-4 py-3">
          <div
            class="h-4 bg-gray-300 dark-theme:bg-gray-600 rounded animate-pulse mb-2"
          />
          <div
            class="h-3 bg-gray-300 dark-theme:bg-gray-600 rounded animate-pulse w-1/2"
          />
        </div>
      </CardBottom>
    </template>
  </CardContainer>

  <!-- Error State -->
  <CardContainer
    v-else-if="error"
    :ratio="dense ? 'smallSquare' : 'square'"
    type="asset-card"
  >
    <template #top>
      <CardTop ratio="square">
        <div
          class="w-full h-full flex items-center justify-center bg-gray-50 dark-theme:bg-gray-900"
        >
          <i class="pi pi-exclamation-triangle text-2xl text-red-500" />
        </div>
      </CardTop>
    </template>
    <template #bottom>
      <CardBottom>
        <div class="px-4 py-3">
          <p class="text-sm text-red-500 m-0">{{ error }}</p>
        </div>
      </CardBottom>
    </template>
  </CardContainer>

  <!-- Type-specific cards based on media kind -->
  <component
    :is="getCardComponent(asset.kind)"
    v-else-if="asset"
    :context="context"
    :asset="asset"
    :dense="dense"
    @download="emit('download', $event)"
    @copy-job-id="emit('copyJobId', $event)"
    @open-detail="emit('openDetail', $event)"
    @play="emit('play', $event)"
    @view="emit('view', $event)"
    @copy="emit('copy', $event)"
  />
</template>

<script setup lang="ts">
import QueueAudioCard from '@/components/assetLibrary/cards/QueueAudioCard.vue'
import QueueImageCard from '@/components/assetLibrary/cards/QueueImageCard.vue'
import QueueTextCard from '@/components/assetLibrary/cards/QueueTextCard.vue'
import QueueVideoCard from '@/components/assetLibrary/cards/QueueVideoCard.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import type { AssetContext, AssetMeta, MediaKind } from '@/types/media.types'

// Map media types to their specific card components
const cardComponents = {
  video: QueueVideoCard,
  webm: QueueVideoCard,
  audio: QueueAudioCard,
  image: QueueImageCard,
  webp: QueueImageCard,
  gif: QueueImageCard,
  text: QueueTextCard,
  pose: QueueImageCard,
  other: QueueImageCard
}

function getCardComponent(kind: MediaKind) {
  return cardComponents[kind] || QueueImageCard
}

defineProps<{
  context: AssetContext
  asset: AssetMeta
  loading?: boolean
  error?: string | null
  dense?: boolean
}>()

const emit = defineEmits<{
  download: [assetId: string]
  copyJobId: [jobId: string]
  openDetail: [assetId: string]
  play: [assetId: string]
  view: [assetId: string]
  copy: [assetId: string]
}>()
</script>
