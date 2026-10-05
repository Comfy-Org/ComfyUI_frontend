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
      :role="kind === 'audio' || kind === 'video' ? 'img' : undefined"
      :aria-label="
        kind === 'audio' || kind === 'video'
          ? $t(
              kind === 'audio'
                ? 'sideToolbar.mediaAssets.filterAudio'
                : 'sideToolbar.mediaAssets.filterVideo'
            )
          : undefined
      "
      :aria-hidden="(kind !== 'audio' && kind !== 'video') || undefined"
      :class="
        cn(
          icon,
          'shrink-0',
          variant === 'tray'
            ? 'size-6 text-muted-foreground'
            : variant === 'menu'
              ? 'size-3.5'
              : 'size-3'
        )
      "
    />
  </span>
</template>
