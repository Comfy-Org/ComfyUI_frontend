<template>
  <div
    class="h-1.5 w-full overflow-hidden rounded-full bg-secondary-background"
  >
    <div
      class="h-full rounded-full bg-warning-background transition-[width]"
      :style="{ width: `${clamped * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { value } = defineProps<{ value: number }>()

const clamped = computed(() => Math.min(1, Math.max(0, value)))
</script>
