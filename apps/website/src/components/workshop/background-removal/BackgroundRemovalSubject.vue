<script setup lang="ts">
import { subjectMaskImage } from '../../../lib/workshop/background-removal/mask'

const { url } = defineProps<{ url: string }>()
</script>

<template>
  <img
    :src="url"
    alt=""
    draggable="false"
    class="pointer-events-none size-full object-cover"
    :style="{ maskImage: subjectMaskImage(url), maskSize: '100% 100%' }"
  />
</template>
