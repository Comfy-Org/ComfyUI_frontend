<template>
  <i :class="icon" class="text-neutral text-sm shrink-0" />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

const { icon } = defineProps<{
  icon: NavItemData['icon']
}>()
</script>
