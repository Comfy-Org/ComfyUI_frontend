<template>
  <i :class="icon" class="size-4 shrink-0 text-foreground" />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
