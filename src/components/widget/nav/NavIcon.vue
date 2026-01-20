<template>
  <i
    :class="icon"
    class="text-neutral shrink-0 text-sm"
  />
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

defineProps<{
  icon: NavItemData['icon']
}>()
</script>
