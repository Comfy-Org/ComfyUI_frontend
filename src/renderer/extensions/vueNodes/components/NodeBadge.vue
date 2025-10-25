<template>
  <div
    v-if="badge.icon || badge.text"
    class="flex flex-auto items-center rounded-sm bg-node-component-surface px-1 py-0.5 text-xs"
    :style="{
      color: badge.fgColor,
      backgroundColor: badge.bgColor
    }"
  >
    {{ badge.text }}
  </div>
</template>
<script setup lang="ts">
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

const { badge } = defineProps<{
  badge: LGraphBadge
}>()
</script>
