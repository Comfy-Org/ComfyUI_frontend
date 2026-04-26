<template>
  <!-- Color is the TEMPORARY App Mode accent — see definition in
       LayoutView.vue (`--color-app-mode-accent-temp*`). -->
  <div
    class="flex size-layout-cell shrink-0 items-center justify-center rounded-lg border border-(--color-app-mode-accent-temp-deep) bg-(--color-app-mode-accent-temp) text-white"
  >
    <span class="text-layout-xl font-bold">
      {{ index + 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  index: number
}>()
</script>
