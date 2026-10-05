<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const { name, previewUrl, variant } = defineProps<{
  name: string
  previewUrl?: string
  variant: 'tray' | 'inline' | 'menu'
}>()
const kind = computed(() => getMediaTypeFromFilename(name))
const isMediaIcon = computed(
  () => variant === 'tray' && (kind.value === 'audio' || kind.value === 'video')
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
  if (variant !== 'tray') return 'icon-[lucide--paperclip]'
  return kind.value === 'other'
    ? 'icon-[lucide--file]'
    : iconForMediaType(kind.value)
})
</script>

<template>
  <span class="flex items-center justify-center">
    <img
      v-if="previewUrl && kind === 'image'"
      :src="previewUrl"
      :alt="variant === 'tray' ? name : ''"
      :aria-hidden="variant !== 'tray' || undefined"
      class="size-full rounded-sm object-cover"
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
