<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

const { file, src, kind, name } = defineProps<{
  file?: File
  src?: string
  kind: 'video' | 'audio'
  name: string
}>()
const objectUrl = useObjectUrl(() => file)
const source = computed(() => objectUrl.value ?? src)
</script>

<template>
  <video
    v-if="source && kind === 'video'"
    :key="source"
    :src="source"
    :aria-label="name"
    controls
    playsinline
    preload="metadata"
    class="bg-transparency-white-t4 h-32 w-full rounded-xl object-contain"
  />
  <audio
    v-else-if="source"
    :key="source"
    :src="source"
    :aria-label="name"
    controls
    preload="metadata"
    class="w-full"
  />
</template>
