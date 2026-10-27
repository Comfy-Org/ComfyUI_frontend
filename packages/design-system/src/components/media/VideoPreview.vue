<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

const { src } = defineProps<{
  src: string
  label?: string
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
  <span class="z-10 self-center">
    {{ `${width} x ${height}` }}
    <template v-if="label"> | {{ label }}</template>
  </span>
</template>
