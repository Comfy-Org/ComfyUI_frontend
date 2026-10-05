<script setup lang="ts">
import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'
const { name, previewUrl } = defineProps<{
  name: string
  previewUrl?: string
}>()
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="150">
    <HoverCardTrigger as-child><slot /></HoverCardTrigger>
    <HoverCardContent
      side="top"
      align="start"
      :collision-padding="16"
      class="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0"
    >
      <div role="tooltip" :aria-label="name">
        <img
          v-if="previewUrl && getMediaTypeFromFilename(name) === 'image'"
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
