<script setup lang="ts">
import Button from '../ui/button/Button.vue'

type Asset = {
  id: string
  title: string
  preview: string
}

type Cta = {
  label: string
  href: string
}

defineProps<{
  heading: string
  subheading: string
  cta: Cta
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
        <div class="p-5">
          <h3 class="text-base font-light text-primary-comfy-canvas">
            {{ asset.title }}
          </h3>
        </div>
      </li>
    </ul>

    <div class="mt-12 flex justify-center">
      <Button as="a" :href="cta.href" variant="outline" size="default">
        {{ cta.label }}
      </Button>
    </div>
  </section>
</template>
