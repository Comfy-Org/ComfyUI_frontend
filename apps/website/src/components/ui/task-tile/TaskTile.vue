<script setup lang="ts">
defineProps<{
  title: string
  description: string
  meta: string
}>()
</script>

<template>
  <article
    class="bg-transparency-white-t4 rounded-5xl flex h-full flex-col overflow-hidden p-2"
  >
    <div
      v-if="$slots.media"
      class="bg-transparency-white-t4 aspect-video overflow-hidden rounded-4.5xl"
    >
      <slot name="media" />
    </div>
    <div class="flex grow flex-col gap-2.5 p-3">
      <h3
        class="text-primary-comfy-canvas text-sm font-extrabold tracking-wide uppercase"
      >
        {{ title }}
      </h3>
      <p class="text-primary-warm-gray text-sm/relaxed font-light">
        {{ description }}
      </p>
      <p
        class="text-primary-comfy-yellow mt-auto pt-1 text-xs font-extrabold tracking-wide uppercase"
      >
        {{ meta }}
      </p>
    </div>
  </article>
</template>
