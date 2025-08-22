<script setup lang="ts">
defineProps<{
  color?: string
}>()
</script>

<template>
  <div
    :style="{ backgroundColor: color }"
    class="bg-[#5B5E7D] w-[13.3px] h-[29.3px] rounded-full"
  />
</template>
