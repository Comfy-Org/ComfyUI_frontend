<script setup lang="ts">
const {
  title,
  href,
  mediaSrc,
  mediaType = 'image'
} = defineProps<{
  title: string
  href: string
  mediaSrc: string
  mediaType?: 'image' | 'video'
}>()
</script>

<template>
  <a
    :href="href"
    :aria-label="title"
    class="group focus-visible:ring-primary-comfy-yellow rounded-4.5xl relative aspect-4/5 overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-comfy-ink focus-visible:outline-none"
  >
    <video
      v-if="mediaType === 'video'"
      :src="mediaSrc"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      aria-hidden="true"
      autoplay
      loop
      muted
      playsinline
      preload="metadata"
    />
    <img
      v-else
      :src="mediaSrc"
      alt=""
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      decoding="async"
    />

    <div
      class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink/90 via-primary-comfy-ink/15 to-transparent"
      aria-hidden="true"
    />
    <h3
      class="absolute inset-x-0 bottom-0 p-6 text-3xl/tight font-bold whitespace-pre-line text-white sm:text-4xl/tight lg:text-[1.75rem]/tight 2xl:p-8 2xl:text-4xl/tight"
    >
      {{ title }}
    </h3>
  </a>
</template>
