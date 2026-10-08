<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { ReplyVisualAsset } from '../../../utils/replyAssets'

const { asset, multi, modelThumbnailSrc } = defineProps<{
  asset: ReplyVisualAsset
  multi: boolean
  modelThumbnailSrc: string
}>()

defineEmits<{ inspect: [] }>()

function playPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) void video.play().catch(() => {})
}

function stopPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) video.pause()
}
</script>

<template>
  <button
    type="button"
    :aria-label="asset.label ?? asset.filename"
    :class="
      cn(
        'relative cursor-pointer overflow-hidden rounded-lg border-none p-0',
        multi && 'aspect-square bg-secondary-background-hover',
        !multi && asset.kind === '3D' && 'justify-self-end'
      )
    "
    @click="$emit('inspect')"
  >
    <img
      v-if="asset.kind === 'image'"
      :src="asset.url"
      :alt="asset.label ?? asset.filename"
      data-testid="reply-image-preview"
      loading="lazy"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
    />
    <video
      v-else-if="asset.kind === 'video'"
      :src="asset.url"
      data-testid="reply-video-preview"
      muted
      loop
      playsinline
      preload="metadata"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
      @mouseenter="playPreview"
      @mouseleave="stopPreview"
    />
    <img
      v-else-if="modelThumbnailSrc"
      :src="modelThumbnailSrc"
      :alt="asset.label ?? asset.filename"
      loading="lazy"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
    />
    <span
      v-else
      :class="
        cn(
          'flex items-center justify-center',
          multi
            ? 'size-full'
            : 'aspect-square w-40 bg-secondary-background-hover'
        )
      "
    >
      <span class="icon-[lucide--box] size-6 text-muted-foreground" />
    </span>
    <span
      v-if="asset.kind === 'video'"
      data-testid="reply-video-affordance"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        class="flex size-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm"
      >
        <span class="icon-[lucide--play] size-4 fill-current" />
      </span>
    </span>
  </button>
</template>
