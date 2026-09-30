<script setup lang="ts">
const { title, subtitle, titleId } = defineProps<{
  title: string
  subtitle: string
  titleId?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <h2
      :id="titleId"
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ title }}
    </h2>
    <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
      {{ subtitle }}
    </p>
  </div>
</template>
