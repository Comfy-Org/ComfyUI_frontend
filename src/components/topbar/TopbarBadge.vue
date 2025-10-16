<template>
  <div class="flex items-center gap-2 bg-comfy-menu-secondary px-3">
    <div
      v-if="badge.label"
      class="rounded-full bg-white px-1.5 py-0.5 text-xxxs font-semibold text-black"
    >
      {{ badge.label }}
    </div>
    <div class="font-inter text-sm font-extrabold text-slate-100">
      {{ badge.text }}
    </div>
  </div>
</template>
<script setup lang="ts">
import type { TopbarBadge } from '@/types/comfy'

defineProps<{
  badge: TopbarBadge
}>()
</script>
