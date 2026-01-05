<script setup lang="ts" generic="T extends HTMLElement">
const { elementToString } = defineProps<{
  elementToString: (e: T) => string
}>()
</script>
<template>
  <span v-text="elementToString($el?.previousElementSibling)" />
</template>
