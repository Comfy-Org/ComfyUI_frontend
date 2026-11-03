<template>
  <div
    v-if="previewUrl"
    class="relative size-full"
    @click="emit('preview-click')"
  >
    <template v-if="isVideoPreview">
      <template v-if="!videoFailed">
        <video
          :src="videoSrc"
          preload="metadata"
          muted
          playsinline
          class="pointer-events-none size-full object-cover"
          @error="emit('video-error')"
        />
        <VideoPlayOverlay size="sm" />
      </template>
      <i
        v-else
        aria-hidden="true"
        class="absolute inset-0 m-auto icon-[lucide--video-off] text-muted-foreground"
      />
    </template>
    <img
      v-else-if="failedImageUrl !== previewUrl"
      :src="previewUrl"
      :alt="previewAlt"
      class="size-full object-cover"
      :draggable="false"
      @error="failedImageUrl = previewUrl"
    />
    <i
      v-else
      aria-hidden="true"
      class="absolute inset-0 m-auto icon-[lucide--image] text-muted-foreground"
    />
  </div>
  <div
    v-else
    class="flex size-full items-center justify-center"
    @click="emit('preview-click')"
  >
    <i
      aria-hidden="true"
      :class="
        cn(
          iconName ?? 'icon-[lucide--image]',
          'text-muted-foreground',
          iconClass
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import VideoPlayOverlay from '@comfyorg/design-system/media/VideoPlayOverlay'
import { ref } from 'vue'

const {
  previewUrl,
  previewAlt,
  iconName,
  iconClass,
  isVideoPreview,
  videoSrc,
  videoFailed
} = defineProps<{
  previewUrl?: string
  previewAlt: string
  iconName?: string
  iconClass?: string
  isVideoPreview: boolean
  videoSrc?: string
  videoFailed: boolean
}>()

const emit = defineEmits<{
  'preview-click': []
  'video-error': []
}>()

const failedImageUrl = ref<string>()
</script>
