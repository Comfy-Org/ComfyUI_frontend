<script setup lang="ts">
defineProps<{ title: string; price: string }>()
</script>
<template>
  <div class="not-last:mb-4">
    <div class="text-muted-foreground" v-text="title" />
    <span
      class="mt-2 flex h-5 max-w-max items-center rounded-full bg-component-node-widget-background p-2 py-3"
    >
      <i class="mr-1 icon-[lucide--component] h-4 bg-amber-400" />
      {{ price }}
    </span>
  </div>
</template>
