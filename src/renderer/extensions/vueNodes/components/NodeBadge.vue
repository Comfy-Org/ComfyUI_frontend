<template>
  <div
    v-if="badgeData.icon || badgeData.text"
    class="flex-auto rounded-sm bg-node-component-surface p-1"
    :style="{
      color: badgeData.fgColor,
      backgroundColor: badgeData.bgColor
    }"
  >
    <component :is="badgeData.icon" v-if="badgeData.icon" />
    {{ badgeData.text }}
  </div>
</template>
<script setup lang="ts">
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

const { badge } = defineProps<{
  badge: MaybeRefOrGetter<LGraphBadge>
}>()

const badgeData = computed(() => toValue(badge))
</script>
