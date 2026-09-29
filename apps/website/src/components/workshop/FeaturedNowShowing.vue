<script setup lang="ts">
const { title, kind, href } = defineProps<{
  title: string
  kind: string
  href: string
}>()
</script>

<template>
  <div
    class="flex w-full min-w-0 items-center justify-center gap-4"
    data-testid="featured-now-showing"
  >
    <a
      :href
      class="min-w-0 truncate text-sm text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    >
      {{ title }} · {{ kind }}
    </a>
    <slot />
  </div>
</template>
