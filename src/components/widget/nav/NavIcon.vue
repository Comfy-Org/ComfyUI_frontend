<template>
  <i :class="icon" class="size-4 shrink-0 text-base-foreground" />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
