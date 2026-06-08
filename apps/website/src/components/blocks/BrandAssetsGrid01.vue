<script setup lang="ts">
type Asset = {
  id: string
  title: string
  download: string
  preview: string
}

defineProps<{
  heading: string
  subheading: string
  downloadLabel: string
  assets: readonly Asset[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="mx-auto max-w-6xl text-center">
      <h2
        class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
      >
        {{ heading }}
      </h2>
      <p class="mx-auto mt-4 max-w-2xl text-base text-primary-comfy-canvas/70">
        {{ subheading }}
      </p>
    </div>

    <ul
      class="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      <li
        v-for="asset in assets"
        :key="asset.id"
        class="bg-transparency-white-t4 flex flex-col overflow-hidden rounded-4xl border border-primary-comfy-canvas/10"
      >
        <div
          class="flex aspect-video items-center justify-center overflow-hidden bg-primary-comfy-ink/40 p-6"
        >
          <img
            :src="asset.preview"
            :alt="asset.title"
            class="max-h-full max-w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div class="flex flex-1 flex-col gap-2 p-5">
          <h3 class="text-base font-light text-primary-comfy-canvas">
            {{ asset.title }}
          </h3>
          <a
            :href="asset.download"
            :download="asset.download.split('/').pop()"
            class="text-primary-comfy-yellow mt-auto inline-flex items-center gap-1 text-sm font-bold tracking-wider uppercase hover:underline"
          >
            {{ downloadLabel }}
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </li>
    </ul>
  </section>
</template>
