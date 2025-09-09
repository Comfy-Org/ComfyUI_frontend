<template>
  <span v-if="icon" class="text-xs text-neutral">
    <component :is="icon" />
  </span>
</template>

<script setup lang="ts">
import { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
