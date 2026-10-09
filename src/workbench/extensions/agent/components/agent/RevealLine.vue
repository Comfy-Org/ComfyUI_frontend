<script setup lang="ts">
const { index, enabled = true } = defineProps<{
  index: number
  enabled?: boolean
}>()
</script>

<template>
  <span v-if="enabled" class="agent-reveal-mask">
    <span class="agent-reveal-line" :style="{ '--reveal-index': index }">
      <slot />
    </span>
  </span>
  <slot v-else />
</template>
