<script setup lang="ts">
import ModelExploreCard from './ModelExploreCard.vue'

defineProps<{
  href: string
  title: string
  description: string
  meta: string
  mediaSrc: string
}>()
</script>

<template>
  <ModelExploreCard
    variant="hub"
    :item="{
      id: href,
      title,
      href,
      description,
      tags: [meta],
      media: { type: 'image', src: mediaSrc, alt: '' }
    }"
  />
</template>
