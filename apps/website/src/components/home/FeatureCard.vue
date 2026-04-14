<script setup lang="ts">
const { title, description } = defineProps<{
  title: string
  description: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="rounded-5xl bg-primary-comfy-yellow text-primary-comfy-ink w-full cursor-pointer p-8 text-left transition-all"
    @click="emit('click')"
  >
    <h3 class="text-2xl/tight font-medium">
      {{ title }}
    </h3>
    <p class="mt-4 text-sm/relaxed font-normal opacity-80">
      {{ description }}
    </p>
  </button>
</template>
