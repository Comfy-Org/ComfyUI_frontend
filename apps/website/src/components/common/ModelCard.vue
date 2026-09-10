<script setup lang="ts">
type ModelCardMedia =
  | { type: 'image'; src: string }
  | { type: 'video'; src: string; poster: string }

const { modelName, capability, href, providerName, providerLogoSrc, media } =
  defineProps<{
    modelName: string
    capability: string
    href: string
    providerName: string
    providerLogoSrc: string
    media: ModelCardMedia
  }>()
</script>

<template>
  <a :href :aria-label="`${providerName} ${modelName} ${capability}`">
    <img v-if="media.type === 'image'" :src="media.src" alt="" />
    <video
      v-else
      :src="media.src"
      :poster="media.poster"
      :aria-label="`${modelName} preview`"
      autoplay
      loop
      muted
      playsinline
    />
    <div>
      <img :src="providerLogoSrc" :alt="providerName" />
      <h2>{{ modelName }}</h2>
      <h3>{{ capability }}</h3>
    </div>
  </a>
</template>
