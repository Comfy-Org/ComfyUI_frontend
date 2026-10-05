<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import AssetMediaPreview from './AssetMediaPreview.vue'

const { name, previewUrl, mediaUrl, mediaKind } = defineProps<{
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
}>()
const kind = computed(() => mediaKind ?? getMediaTypeFromFilename(name))
const playableKind = computed(() =>
  kind.value === 'video' || kind.value === 'audio' ? kind.value : undefined
)
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="150">
    <HoverCardTrigger as-child>
      <slot />
    </HoverCardTrigger>
    <HoverCardContent
      side="top"
      align="start"
      :collision-padding="16"
      :class="
        cn(
          'max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0',
          playableKind === 'audio' ? 'w-86' : 'w-80'
        )
      "
    >
      <div
        :role="mediaUrl && playableKind ? 'region' : 'tooltip'"
        :aria-label="name"
      >
        <AssetMediaPreview
          v-if="mediaUrl && playableKind"
          :key="`${playableKind}:${mediaUrl}`"
          :name
          :media-url
          :kind="playableKind"
          :poster-url="previewUrl"
        />
        <img
          v-else-if="previewUrl && (kind === 'image' || kind === 'video')"
          :src="previewUrl"
          :alt="name"
          class="max-h-80 w-full object-contain"
        />
        <div class="px-3 py-2 text-sm wrap-anywhere text-base-foreground">
          {{ name }}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
