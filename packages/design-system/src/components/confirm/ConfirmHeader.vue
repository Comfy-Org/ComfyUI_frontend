<template>
  <div class="flex items-center gap-2 p-4 text-sm font-normal">
    <i v-if="icon" :class="icon" aria-hidden="true" />
    <span v-if="title" class="flex-auto">{{ title }}</span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  title?: string
  icon?: string
}>()
</script>
