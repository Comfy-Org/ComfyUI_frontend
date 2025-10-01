<template>
  <div class="relative w-full h-full">
    <!-- Audio type - use AudioThumbnail pattern -->
    <template v-if="asset.kind === 'audio'">
      <AudioThumbnail v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" />
      <div
        v-else
        class="w-full h-full flex items-center justify-center p-4 bg-gray-100 dark-theme:bg-gray-800 rounded-t-lg"
        :style="{
          backgroundImage: 'url(/assets/images/default-template.png)',
          backgroundRepeat: 'round'
        }"
      >
        <div class="flex items-center justify-center">
          <i class="pi pi-volume-up text-3xl text-gray-600" />
        </div>
      </div>
    </template>

    <!-- Video types - show thumbnail or video player -->
    <template v-else-if="isVideoType">
      <!-- Show video player if clicked -->
      <BaseThumbnail
        v-if="showVideoPlayer && (asset.videoUrl || asset.thumbnailUrl)"
      >
        <video
          controls
          autoplay
          class="w-full h-full object-cover"
          :poster="asset.thumbnailUrl"
          @click.stop
        >
          <source :src="asset.videoUrl || asset.thumbnailUrl || ''" />
        </video>
      </BaseThumbnail>
      <!-- Show thumbnail with play button initially -->
      <div v-else-if="asset.thumbnailUrl && !showVideoPlayer">
        <DefaultThumbnail
          :src="asset.thumbnailUrl"
          :alt="asset.name"
          :hover-zoom="0"
          :is-video="true"
        />
        <!-- Clickable play icon overlay -->
        <div
          class="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors"
          @click="handlePlayClick"
        >
          <div
            class="w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          >
            <i class="pi pi-play text-white text-xl ml-1" />
          </div>
        </div>
      </div>
      <!-- Fallback when no video URL -->
      <BaseThumbnail v-else>
        <div
          class="w-full h-full flex items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
        >
          <i class="pi pi-video text-3xl text-gray-400" />
        </div>
      </BaseThumbnail>
    </template>

    <!-- Image types (including gif, webp) - use DefaultThumbnail -->
    <template v-else-if="isImageType">
      <DefaultThumbnail
        v-if="asset.thumbnailUrl"
        :src="asset.thumbnailUrl"
        :alt="asset.name"
        :hover-zoom="5"
      />
      <!-- Fallback when no thumbnail -->
      <BaseThumbnail v-else>
        <div
          class="w-full h-full flex items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
        >
          <i :class="iconClass" class="text-3xl text-gray-400" />
        </div>
      </BaseThumbnail>
    </template>

    <!-- Text/Pose/Other types - simple icon display -->
    <template v-else>
      <BaseThumbnail>
        <div
          class="w-full h-full flex items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
        >
          <i :class="iconClass" class="text-3xl text-gray-400" />
        </div>
      </BaseThumbnail>
    </template>

    <!-- Media type badge -->
    <div v-if="showBadge" class="absolute top-2 right-2">
      <!-- PRIMARY-MULTI badge for multiple files -->
      <div
        v-if="asset.isMulti"
        class="inline-flex justify-center items-center gap-1 shrink-0 py-1 px-2 text-xs bg-purple-600 rounded font-medium text-white"
      >
        <i class="pi pi-copy text-xs" />
        <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
        <span>MULTI</span>
      </div>
      <!-- Regular media type badge -->
      <SquareChip v-else :label="asset.kind">
        <template #icon>
          <i :class="iconClass" />
        </template>
      </SquareChip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import SquareChip from '@/components/chip/SquareChip.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import type { AssetMeta } from '@/types/media.types'
import { kindToIcon } from '@/utils/media.utils'

const props = defineProps<{
  asset: AssetMeta
  showBadge?: boolean
}>()

const isImageType = computed(() => {
  return ['image', 'webp', 'gif'].includes(props.asset.kind)
})

const isVideoType = computed(() => {
  return ['video', 'webm'].includes(props.asset.kind)
})

const iconClass = computed(() => kindToIcon(props.asset.kind))

// State for showing video player
const showVideoPlayer = ref(false)

// Handle play button click
function handlePlayClick() {
  showVideoPlayer.value = true
}
</script>
