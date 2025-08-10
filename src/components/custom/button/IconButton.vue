<template>
  <button
    class="flex justify-center items-center flex-shrink-0 outline-none border-none p-0 bg-white text-neutral-950 dark-theme:bg-zinc-700 dark-theme:text-white w-8 h-8 rounded-lg cursor-pointer"
    role="button"
    @click="onClick"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
const { onClick } = defineProps<{
  onClick: () => void
}>()
</script>
