<template>
  <div class="flex-auto rounded-sm bg-node-component-surface p-1">
    {{ badgeText }}
  </div>
</template>
<script setup lang="ts">
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

const { badge } = defineProps<{
  badge: MaybeRefOrGetter<LGraphBadge>
}>()

const badgeText = computed(() => toValue(badge).text)
</script>
