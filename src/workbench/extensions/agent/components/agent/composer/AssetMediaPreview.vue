<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const { name, mediaUrl, kind, posterUrl } = defineProps<{
  name: string
  mediaUrl: string
  kind: 'video' | 'audio'
  posterUrl?: string
}>()
const player = useTemplateRef<HTMLMediaElement>('player')
const failed = ref(false)
const colorPaletteStore = useColorPaletteStore()
const colorScheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)
onBeforeUnmount(() => player.value?.pause())
</script>

<template>
  <div :style="{ colorScheme }">
    <video
      v-if="kind === 'video'"
      ref="player"
      :aria-label="name"
      :src="mediaUrl"
      :poster="posterUrl"
      controls
      playsinline
      preload="metadata"
      class="max-h-80 w-full object-contain"
      @error="failed = true"
    />
    <div v-else class="p-3">
      <audio
        ref="player"
        :aria-label="name"
        :src="mediaUrl"
        controls
        preload="metadata"
        class="block w-full"
        @error="failed = true"
      />
    </div>
    <p
      v-if="failed"
      role="status"
      class="px-3 py-2 text-sm text-muted-foreground"
    >
      {{ $t(kind === 'video' ? 'g.videoFailedToLoad' : 'g.audioFailedToLoad') }}
    </p>
  </div>
</template>
