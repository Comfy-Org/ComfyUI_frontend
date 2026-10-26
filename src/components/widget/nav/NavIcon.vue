<template>
  <i :class="icon" class="shrink-0 text-sm text-foreground" />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
