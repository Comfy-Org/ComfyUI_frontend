<script setup lang="ts">
const { title, description, cta, href, bg } = defineProps<{
  title: string
  description: string
  cta: string
  href: string
  bg: string
}>()
</script>

<template>
  <a
    :href="href"
    class="flex flex-col justify-between rounded-2xl p-8 transition-opacity hover:opacity-90"
    :class="bg"
  >
    <h3 class="text-3xl font-light whitespace-pre-line text-white lg:text-4xl">
      {{ title }}
    </h3>

    <div class="mt-auto pt-16">
      <p class="text-sm text-white/70">
        {{ description }}
      </p>
      <span
        class="bg-primary-comfy-yellow text-primary-comfy-ink mt-4 inline-block rounded-xl px-4 py-2 text-xs font-bold tracking-wide"
      >
        {{ cta }}
      </span>
    </div>
  </a>
</template>
