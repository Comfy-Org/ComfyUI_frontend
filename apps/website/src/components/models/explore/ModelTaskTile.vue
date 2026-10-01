<script setup lang="ts">
defineProps<{
  href: string
  title: string
  description: string
  meta: string
  mediaSrc: string
}>()
</script>

<template>
  <a
    :href="href"
    class="flex h-full flex-col overflow-hidden rounded-5xl bg-transparency-white-t4 p-2"
  >
    <div
      class="aspect-video overflow-hidden rounded-4.5xl bg-transparency-white-t4"
    >
      <img
        :src="mediaSrc"
        alt=""
        class="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div class="flex grow flex-col gap-2.5 p-3">
      <h3
        class="text-sm font-extrabold tracking-wide text-primary-comfy-canvas uppercase"
      >
        {{ title }}
      </h3>
      <p class="text-sm/relaxed font-light text-primary-warm-gray">
        {{ description }}
      </p>
      <p
        class="mt-auto pt-1 text-xs font-extrabold tracking-wide text-primary-comfy-yellow uppercase"
      >
        {{ meta }}
      </p>
    </div>
  </a>
</template>
