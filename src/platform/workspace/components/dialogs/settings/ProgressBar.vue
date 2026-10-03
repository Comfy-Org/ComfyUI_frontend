<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-secondary-background-hover"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(clamped * 100)"
  >
    <div
      class="h-full rounded-full bg-credit transition-[width]"
      :style="{ width: `${clamped * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { value } = defineProps<{ value: number }>()

const clamped = computed(() => Math.min(1, Math.max(0, value)))
</script>
