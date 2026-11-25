<script setup lang="ts">
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  mediaType,
  mediaUrl,
  label,
  iconClass,
  isHovered = false
} = defineProps<{
  mediaType: 'image' | 'video' | 'audio'
  mediaUrl?: string
  label?: string
  iconClass?: string
  isHovered?: boolean
}>()
</script>
<template>
  <div
    :class="
      cn(
        'flex h-full max-w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[7px] p-3 text-center text-sm/tight transition-colors',
        isHovered &&
          !mediaUrl &&
          'border border-dashed border-muted-foreground bg-muted'
      )
    "
  >
    <div v-if="mediaUrl" class="max-h-full max-w-full">
      <img
        v-if="mediaType === 'image'"
        class="max-h-full max-w-full rounded-md object-contain"
        data-testid="drop-zone-media"
        :alt="label ?? ''"
        :src="mediaUrl"
      />
      <video
        v-else-if="mediaType === 'video'"
        class="max-h-full max-w-full rounded-md object-contain"
        data-testid="drop-zone-media"
        :aria-label="label ?? ''"
        :src="mediaUrl"
        controls
        playsinline
        preload="metadata"
        @click.stop
      />
      <AudioPreviewPlayer
        v-else
        data-testid="drop-zone-media"
        :model-value="mediaUrl"
        :hide-when-empty="false"
        @click.stop
      />
    </div>
    <template v-else>
      <span v-if="label" v-text="label" />
      <i v-if="iconClass" :class="cn('text-muted-foreground', iconClass)" />
    </template>
  </div>
</template>
