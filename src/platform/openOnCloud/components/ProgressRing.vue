<template>
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke-width="2"
    class="-rotate-90"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6" class="stroke-border" />
    <circle
      cx="8"
      cy="8"
      r="6"
      pathLength="100"
      :stroke-dasharray="`${percent} 100`"
      class="stroke-foreground"
    />
  </svg>
</template>

<script setup lang="ts">
const { percent } = defineProps<{
  percent: number
}>()
</script>
