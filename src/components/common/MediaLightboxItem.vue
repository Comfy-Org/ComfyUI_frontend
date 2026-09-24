<template>
  <KeepAlive :max="RETAINED_VIDEO_COUNT">
    <LightboxVideo
      v-if="item.kind === 'video'"
      :key="item.url"
      :url="item.url"
      :mime-type="item.mimeType"
      :advanced-preview-url="item.advancedPreviewUrl"
    />
  </KeepAlive>
  <ComfyImage
    v-if="item.kind === 'image'"
    :key="item.url"
    :src="item.url"
    :contain="false"
    :alt="item.alt ?? ''"
    class="size-auto max-h-[90vh] max-w-[90vw] object-contain"
  />
  <LightboxAudio v-if="item.kind === 'audio'" :url="item.url" />
  <LightboxText
    v-if="item.kind === 'text'"
    :url="item.url"
    :content="item.content"
  />
</template>

<script setup lang="ts">
import ComfyImage from '@/components/common/ComfyImage.vue'
import type { LightboxItem } from '@/types/lightboxItem'

import LightboxAudio from './LightboxAudio.vue'
import LightboxText from './LightboxText.vue'
import LightboxVideo from './LightboxVideo.vue'

const { item } = defineProps<{
  readonly item: LightboxItem
}>()

const RETAINED_VIDEO_COUNT = 3
</script>
