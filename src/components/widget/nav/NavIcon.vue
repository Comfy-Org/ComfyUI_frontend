<template>
  <i :class="icon" class="text-xs text-neutral" />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
