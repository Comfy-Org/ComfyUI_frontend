<template>
  <div class="relative h-full w-full">
    <!-- Audio type - use AudioThumbnail pattern -->
    <template v-if="asset.kind === 'audio'">
      <AudioThumbnail v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" />
      <div
        v-else
        class="flex h-full w-full items-center justify-center rounded-t-lg bg-gray-100 p-4 dark-theme:bg-gray-800"
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
          class="h-full w-full object-cover"
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
          class="absolute inset-0 flex cursor-pointer items-center justify-center transition-colors hover:bg-black/10"
          @click="handlePlayClick"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-colors hover:bg-black/80"
          >
            <i class="pi pi-play ml-1 text-xl text-white" />
          </div>
        </div>
      </div>
      <!-- Fallback when no video URL -->
      <BaseThumbnail v-else>
        <div
          class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
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
          class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
        >
          <i :class="iconClass" class="text-3xl text-gray-400" />
        </div>
      </BaseThumbnail>
    </template>

    <!-- Text/Pose/Other types - simple icon display -->
    <template v-else>
      <BaseThumbnail>
        <div
          class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
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
        class="inline-flex shrink-0 items-center justify-center gap-1 rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white"
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
