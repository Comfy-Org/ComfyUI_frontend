<template>
  <i :class="icon" class="text-sm text-neutral" />
</template>

<script setup lang="ts">
import { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
