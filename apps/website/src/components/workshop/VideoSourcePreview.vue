<script setup lang="ts">
import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

const { file, src, name } = defineProps<{
  file?: File
  src?: string
  name: string
}>()
const mounted = useMounted()
const objectUrl = useObjectUrl(() => (mounted.value ? file : undefined))
const source = computed(() => objectUrl.value ?? src)
</script>

<template>
  <video
    v-if="source"
    :key="source"
    :src="source"
    :aria-label="name"
    muted
    playsinline
    preload="metadata"
    class="size-12 shrink-0 rounded-lg bg-transparency-white-t8 object-cover"
  />
</template>
