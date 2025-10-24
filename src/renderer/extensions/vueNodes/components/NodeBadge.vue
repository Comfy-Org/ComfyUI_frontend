<template>
  <div
    v-if="badge.icon || badge.text"
    class="flex-auto rounded-sm bg-node-component-surface p-1"
    :style="{
      color: badge.fgColor,
      backgroundColor: badge.bgColor
    }"
  >
    <component :is="badge.icon" v-if="badge.icon" />
    {{ badge.text }}
  </div>
</template>
<script setup lang="ts">
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

const { badge } = defineProps<{
  badge: LGraphBadge
}>()
</script>
