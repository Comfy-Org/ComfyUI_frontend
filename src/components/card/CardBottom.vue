<template>
  <div :class="containerClasses">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { fullHeight = true } = defineProps<{
  fullHeight?: boolean
}>()

const containerClasses = computed(
  () => `flex-1 w-full${fullHeight ? ' h-full' : ''}`
)
</script>
