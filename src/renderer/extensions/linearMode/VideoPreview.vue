<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

const { src, mobile = false } = defineProps<{
  src: string
  mobile?: boolean
}>()

const videoRef = useTemplateRef('videoRef')
const width = ref('')
const height = ref('')
</script>
<template>
  <video
    ref="videoRef"
    :src
    controls
    v-bind="$attrs"
    @loadedmetadata="
      () => {
        if (!videoRef) return
        width = `${videoRef.videoWidth}`
        height = `${videoRef.videoHeight}`
      }
    "
  />
  <span
    v-if="!mobile"
    class="z-10 self-end pr-2"
    v-text="`${width} x ${height}`"
  />
</template>
