<template>
  <h3
    class="m-0 px-3 py-0 pt-5 text-xxs font-bold uppercase text-neutral-400 dark-theme:text-neutral-400"
  >
    {{ title }}
  </h3>
</template>

<script setup lang="ts">
const { title } = defineProps<{
  title: string
}>()
</script>
