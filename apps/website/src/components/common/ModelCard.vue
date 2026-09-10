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
  <a
    :href
    :aria-label="`${providerName} ${modelName} ${capability}`"
    class="focus-visible:ring-primary-comfy-yellow group relative block aspect-4/5 overflow-hidden rounded-3xl bg-primary-comfy-ink focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
  >
    <img
      v-if="media.type === 'image'"
      :src="media.src"
      alt=""
      loading="lazy"
      decoding="async"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
    />
    <video
      v-else
      :src="media.src"
      :poster="media.poster"
      :aria-label="`${modelName} preview`"
      preload="metadata"
      autoplay
      loop
      muted
      playsinline
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent"
      aria-hidden="true"
    />
    <div class="absolute inset-x-0 bottom-0 p-5 text-primary-comfy-canvas">
      <span
        :aria-label="providerName"
        role="img"
        class="mb-3 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-black/30 px-2 backdrop-blur-sm"
      >
        <img :src="providerLogoSrc" alt="" class="max-h-5 max-w-20" />
      </span>
      <h2 class="text-2xl/tight font-light">{{ modelName }}</h2>
      <h3 class="mt-1 text-sm font-bold tracking-wide uppercase">
        {{ capability }}
      </h3>
    </div>
  </a>
</template>
