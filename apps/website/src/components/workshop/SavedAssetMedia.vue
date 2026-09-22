<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { useResumePlayback } from '../../composables/useResumePlayback'
import type { SavedAssetKind } from '../../lib/workshop/saved-assets'

const {
  kind,
  url,
  assetId,
  alt = '',
  controls = false
} = defineProps<{
  kind: SavedAssetKind
  url: string
  /** Which asset the URL points at, so a renewal is told from a move. */
  assetId?: string
  alt?: string
  controls?: boolean
}>()

const emit = defineEmits<{ mediaError: [] }>()

const media = useTemplateRef<HTMLMediaElement>('media')
const { restore } = useResumePlayback(
  media,
  () => assetId,
  () => url
)
</script>

<template>
  <img v-if="kind === 'image'" :src="url" :alt @error="emit('mediaError')" />
  <video
    v-else-if="kind === 'video'"
    ref="media"
    :src="url"
    :controls
    :autoplay="controls"
    :loop="controls"
    :muted="!controls"
    :preload="controls ? undefined : 'metadata'"
    playsinline
    @loadedmetadata="restore"
    @error="emit('mediaError')"
  />
  <audio
    v-else
    ref="media"
    :src="url"
    class="w-full"
    controls
    @loadedmetadata="restore"
    @error="emit('mediaError')"
  />
</template>
