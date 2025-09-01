<template>
  <span class="text-xs text-neutral">
    <component :is="icon" />
  </span>
</template>

<script setup lang="ts">
import { DefineComponent } from 'vue'

defineProps<{
  icon: DefineComponent
}>()
</script>
