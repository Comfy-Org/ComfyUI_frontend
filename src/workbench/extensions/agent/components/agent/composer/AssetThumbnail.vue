<script setup lang="ts">
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const { name, previewUrl, mediaKind, variant } = defineProps<{
  name: string
  previewUrl?: string
  mediaKind?: MediaKind
  variant: 'tray' | 'inline' | 'menu'
}>()
const kind = computed(() => mediaKind ?? getMediaTypeFromFilename(name))
const failedUrl = ref<string>()

function onImageError(event: Event): void {
  if (
    event.target instanceof HTMLImageElement &&
    event.target.getAttribute('src') === previewUrl
  )
    failedUrl.value = event.target.getAttribute('src') ?? undefined
}
const isMediaIcon = computed(
  () => kind.value === 'audio' || kind.value === 'video'
)
const mediaLabel = computed(() =>
  kind.value === 'audio'
    ? 'sideToolbar.mediaAssets.filterAudio'
    : 'sideToolbar.mediaAssets.filterVideo'
)
const iconSize = computed(
  () =>
    ({
      tray: 'size-6 text-muted-foreground',
      menu: 'size-3.5',
      inline: 'size-3'
    })[variant]
)
const icon = computed(() => {
  if (variant !== 'tray' && !isMediaIcon.value)
    return 'icon-[lucide--paperclip]'
  return kind.value === 'other'
    ? 'icon-[lucide--file]'
    : iconForMediaType(kind.value)
})
</script>

<template>
  <span class="flex items-center justify-center">
    <img
      v-if="
        previewUrl &&
        previewUrl !== failedUrl &&
        (kind === 'image' || kind === 'video')
      "
      :key="previewUrl"
      :src="previewUrl"
      :alt="variant === 'tray' ? name : ''"
      :aria-hidden="variant !== 'tray' || undefined"
      class="size-full rounded-sm object-cover"
      @error="onImageError"
    />
    <span
      v-else
      :role="isMediaIcon ? 'img' : undefined"
      :aria-label="isMediaIcon ? $t(mediaLabel) : undefined"
      :aria-hidden="!isMediaIcon || undefined"
      :class="cn(icon, 'shrink-0', iconSize)"
    />
  </span>
</template>
