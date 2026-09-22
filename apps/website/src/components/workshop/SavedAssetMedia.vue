<script setup lang="ts">
import type { SavedAssetKind } from '../../lib/workshop/saved-assets'

const {
  kind,
  url,
  alt = '',
  controls = false
} = defineProps<{
  kind: SavedAssetKind
  url: string
  alt?: string
  controls?: boolean
}>()

const emit = defineEmits<{ mediaError: [] }>()
</script>

<template>
  <img v-if="kind === 'image'" :src="url" :alt @error="emit('mediaError')" />
  <video
    v-else-if="kind === 'video'"
    :src="url"
    :controls
    :autoplay="controls"
    :loop="controls"
    :muted="!controls"
    :preload="controls ? undefined : 'metadata'"
    playsinline
    @error="emit('mediaError')"
  />
  <audio
    v-else
    :src="url"
    class="w-full"
    controls
    @error="emit('mediaError')"
  />
</template>
